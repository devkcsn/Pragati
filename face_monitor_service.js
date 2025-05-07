/**
 * Face Monitoring Service
 * This script handles starting and managing the Python face detection service
 * for quiz monitoring.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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
 * Start a new face monitoring session
 * @param {string} sessionId - Unique identifier for the session (usually quizAttemptId)
 * @returns {Promise<Object>} Object containing the port number for WebSocket connection
 */
function startMonitoringSession(sessionId) {
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

            // Handle process output
            process.stdout.on('data', (data) => {
                console.log(`[Face Monitor ${sessionId}]: ${data}`);
            });

            process.stderr.on('data', (data) => {
                console.error(`[Face Monitor Error ${sessionId}]: ${data}`);
            });

            // Handle process exit
            process.on('close', (code) => {
                console.log(`Face monitoring process for session ${sessionId} exited with code ${code}`);
                
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
                startTime: new Date()
            };

            // Allow a brief moment for the Python server to start
            setTimeout(() => {
                resolve({
                    success: true,
                    websocketPort: port
                });
            }, 1000);
        } catch (error) {
            console.error('Error starting monitoring session:', error);
            reject(error);
        }
    });
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
            uptime: (new Date() - session.startTime) / 1000 // in seconds
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