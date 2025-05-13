/**
 * Face Monitoring Service
 * This script handles starting and managing the Python face detection service
 * for quiz monitoring.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

// Store active monitoring sessions - key is sessionId, value is the python process
const activeMonitoringSessions = {};

// Keep track of assigned WebSocket ports
const usedPorts = new Set();
const PORT_RANGE_START = 8765;
const PORT_RANGE_END = 8865;

/**
 * Find an available port for WebSocket connection
 * @returns {number} Available port number
 */
function findAvailablePort() {
    for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
        if (!usedPorts.has(port)) {
            usedPorts.add(port);
            return port;
        }
    }
    throw new Error('No available ports for face monitoring service');
}

/**
 * Initialize database tables for storing violation frames
 */
async function initViolationFramesTable() {
    try {
        // Create direct connection instead of using db-pool
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
        
        try {
            // Check if violations table exists
            const [tables] = await connection.query(`
                SELECT TABLE_NAME 
                FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'quiz_violation_frames'
            `, [process.env.DB_NAME]);
            
            // Create table if it doesn't exist
            if (tables.length === 0) {
                await connection.query(`
                    CREATE TABLE quiz_violation_frames (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        quiz_id INT NOT NULL,
                        student_username VARCHAR(100) NOT NULL,
                        session_id VARCHAR(100) NOT NULL,
                        violation_type VARCHAR(50) NOT NULL,
                        timestamp DATETIME NOT NULL,
                        frame_data LONGTEXT,
                        incident_count INT DEFAULT 1,
                        INDEX (quiz_id),
                        INDEX (student_username),
                        INDEX (session_id)
                    )
                `);
                console.log("Created quiz_violation_frames table");
            }
        } finally {
            connection.end();
        }
    } catch (err) {
        console.error("Error initializing violation frames table:", err);
    }
}

// Initialize the database table when the service starts
initViolationFramesTable();

/**
 * Start a new face monitoring session
 * @param {string} sessionId - Unique identifier for the session (usually quizAttemptId)
 * @param {Object} sessionData - Additional session data like studentId, quizId
 * @returns {Promise<Object>} Object containing the port number for WebSocket connection
 */
function startMonitoringSession(sessionId, sessionData = {}) {
    return new Promise((resolve, reject) => {
        try {
            // Check if session already exists
            if (activeMonitoringSessions[sessionId]) {
                console.log(`Session ${sessionId} already active, returning existing port`);
                return resolve({
                    success: true,
                    websocketPort: activeMonitoringSessions[sessionId].port
                });
            }

            const port = findAvailablePort();
            const pythonPath = 'python'; // Use 'python3' if on Linux/Mac
            const scriptPath = path.join(__dirname, 'face_monitor.py');

            // Verify script exists
            if (!fs.existsSync(scriptPath)) {
                return reject(new Error(`Face monitoring script not found at ${scriptPath}`));
            }

            // Spawn Python process with parameters
            const process = spawn(pythonPath, [
                scriptPath,
                '--host', 'localhost',
                '--port', port.toString()
            ]);

            // Store session data for this monitoring session
            const fullSessionData = {
                ...sessionData,
                session_id: sessionId,
                start_time: new Date()
            };

            // Handle process output
            process.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(`[Face Monitor ${sessionId}]: ${output}`);
                
                // Check if this output contains violation frame capture info
                if (output.includes('Captured violation frame') || output.includes('Saved violation summary')) {
                    // We'll scan the violation_frames folder for this session later
                    activeMonitoringSessions[sessionId].hasViolations = true;
                }
            });

            process.stderr.on('data', (data) => {
                console.error(`[Face Monitor Error ${sessionId}]: ${data}`);
            });

            // Handle process exit
            process.on('close', async (code) => {
                console.log(`Face monitoring process for session ${sessionId} exited with code ${code}`);
                
                // Check if there were violations and process them
                const session = activeMonitoringSessions[sessionId];
                if (session && session.hasViolations) {
                    try {
                        await processCapturedViolationFrames(sessionId, session.sessionData);
                    } catch (err) {
                        console.error(`Error processing violation frames for session ${sessionId}:`, err);
                    }
                }
                
                // Clean up session
                if (activeMonitoringSessions[sessionId]) {
                    usedPorts.delete(activeMonitoringSessions[sessionId].port);
                    delete activeMonitoringSessions[sessionId];
                }
            });

            // Store session info
            activeMonitoringSessions[sessionId] = {
                process,
                port,
                startTime: new Date(),
                sessionData: fullSessionData,
                hasViolations: false
            };

            // Allow a brief moment for the Python server to start
            setTimeout(() => {
                resolve({
                    success: true,
                    websocketPort: port,
                    sessionData: fullSessionData
                });
            }, 1000);
        } catch (error) {
            console.error('Error starting monitoring session:', error);
            reject(error);
        }
    });
}

/**
 * Process captured violation frames and store them in the database
 * @param {string} sessionId - The session ID
 * @param {Object} sessionData - Session data including student and quiz info
 */
async function processCapturedViolationFrames(sessionId, sessionData) {
    try {
        // Check if the frames folder exists
        const framesFolder = path.join(__dirname, 'violation_frames', sessionId);
        if (!fs.existsSync(framesFolder)) {
            console.log(`No violation frames folder found for session ${sessionId}`);
            return;
        }
        
        // Check if there's a summary file
        const summaryFile = path.join(framesFolder, 'violation_summary.json');
        if (!fs.existsSync(summaryFile)) {
            console.log(`No violation summary found for session ${sessionId}`);
            return;
        }
        
        // Load the summary data
        const summaryData = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
        console.log(`Processing ${summaryData.total_frames} violation frames for session ${sessionId}`);
        
        // Create direct connection instead of using db-pool
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
        
        try {
            // Process each violation
            for (const violation of summaryData.violations) {
                const frameFile = path.join(framesFolder, `violation_${violation.type}_${violation.timestamp}.jpg`);
                
                if (fs.existsSync(frameFile)) {
                    // Read the frame file
                    const frameData = fs.readFileSync(frameFile, 'base64');
                    
                    // Determine incident count from violation type
                    let incidentCount = 1;
                    if (violation.type.includes('multiple_violations')) {
                        incidentCount = 3; // Multiple violations (3+)
                    }
                    
                    // Store in database
                    await connection.execute(
                        `INSERT INTO quiz_violation_frames 
                         (quiz_id, student_username, session_id, violation_type, timestamp, frame_data, incident_count) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            sessionData.quiz_id,
                            sessionData.student_id,
                            sessionId,
                            violation.type,
                            new Date(violation.timestamp.replace(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/, '$1-$2-$3 $4:$5:$6')),
                            frameData,
                            incidentCount
                        ]
                    );
                    
                    console.log(`Stored violation frame ${violation.type} for session ${sessionId}`);
                }
            }
            
            console.log(`Successfully processed all violation frames for session ${sessionId}`);
        } finally {
            connection.end();
        }
    } catch (error) {
        console.error(`Error processing violation frames for session ${sessionId}:`, error);
    }
}

/**
 * Stop an active face monitoring session
 * @param {string} sessionId - Unique identifier for the session
 * @returns {Promise<Object>} Result of the operation
 */
function stopMonitoringSession(sessionId) {
    return new Promise((resolve) => {
        const session = activeMonitoringSessions[sessionId];
        
        if (!session) {
            return resolve({
                success: false,
                message: `No active session found with ID ${sessionId}`
            });
        }
        
        try {
            // Kill the Python process
            session.process.kill();
            
            // Release the port
            usedPorts.delete(session.port);
            
            // Process any captured frames before removing from active sessions
            if (session.hasViolations) {
                processCapturedViolationFrames(sessionId, session.sessionData)
                    .catch(err => console.error(`Error processing violation frames on stop: ${err}`));
            }
            
            // Remove from active sessions
            delete activeMonitoringSessions[sessionId];
            
            resolve({
                success: true,
                message: `Monitoring session ${sessionId} stopped successfully`
            });
        } catch (error) {
            console.error(`Error stopping monitoring session ${sessionId}:`, error);
            resolve({
                success: false,
                message: `Error stopping monitoring session: ${error.message}`
            });
        }
    });
}

/**
 * Get status of all active monitoring sessions
 * @returns {Object} Status of all active monitoring sessions
 */
function getActiveSessionsStatus() {
    const sessions = {};
    
    for (const [sessionId, session] of Object.entries(activeMonitoringSessions)) {
        sessions[sessionId] = {
            port: session.port,
            startTime: session.startTime,
            uptime: (new Date() - session.startTime) / 1000, // in seconds
            hasViolations: session.hasViolations
        };
    }
    
    return {
        activeSessions: Object.keys(activeMonitoringSessions).length,
        sessions: sessions
    };
}

/**
 * Cleanup all monitoring sessions (e.g., on server shutdown)
 */
function cleanupAllSessions() {
    console.log('Cleaning up all face monitoring sessions...');
    
    for (const sessionId of Object.keys(activeMonitoringSessions)) {
        try {
            const session = activeMonitoringSessions[sessionId];
            if (session && session.process) {
                session.process.kill();
                usedPorts.delete(session.port);
                
                // Process any captured frames
                if (session.hasViolations) {
                    processCapturedViolationFrames(sessionId, session.sessionData)
                        .catch(err => console.error(`Error processing violation frames on cleanup: ${err}`));
                }
            }
        } catch (error) {
            console.error(`Error cleaning up session ${sessionId}:`, error);
        }
    }
}

// Clean up sessions on process exit
process.on('exit', cleanupAllSessions);
process.on('SIGINT', () => {
    cleanupAllSessions();
    process.exit(0);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    cleanupAllSessions();
    process.exit(1);
});

module.exports = {
    startMonitoringSession,
    stopMonitoringSession,
    getActiveSessionsStatus,
    cleanupAllSessions
};