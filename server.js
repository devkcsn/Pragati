/**
 * Pragati Online Exam Platform - Server Entry Point
 * 
 * This file serves as the main entry point for the Pragati online exam platform.
 * It handles routes, authentication, quiz management, and security features.
 */

// Import required modules
const express = require('express');       // Web application framework
const session = require('express-session');// Session management middleware
const bodyParser = require('body-parser'); // Request body parsing middleware
const bcrypt = require('bcrypt');         // Password hashing library
const app = express();                    // Create Express application instance
const fsPromises = require('fs').promises;// Promise-based file system operations
const cron = require('node-cron');        // Task scheduling library
const cors = require('cors');             // Cross-Origin Resource Sharing middleware
const path = require('path');             // File path utilities
const fs = require('fs');                 // File system operations
require('dotenv').config();               // Environment variable configuration

// Middleware setup
app.use(cors());                              // Enable CORS for all routes
app.use(express.static('public'));            // Serve static files from 'public' directory
app.use(express.urlencoded({ extended: false, limit: '50mb' })); // Parse URL-encoded form data with increased limit
app.use(bodyParser.json({ limit: '50mb' }));  // Parse JSON request bodies with increased limit
app.set('view engine', 'ejs');                // Set EJS as the template engine

/**
 * Authentication middleware to protect routes
 * 
 * This middleware checks if a user is logged in by verifying the session.
 * If authenticated, the request proceeds; otherwise, redirects to the homepage.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next(); // User is authenticated, proceed to the next middleware/route handler
    }
    res.redirect('/'); // User is not authenticated, redirect to homepage
};

/**
 * Session configuration
 * 
 * Configure Express session middleware with security best practices.
 * Sessions are used to maintain user authentication state.
 */
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_key_change_this', // Secret used to sign the session ID cookie
    resave: false,                    // Don't save session if unmodified
    saveUninitialized: false,         // Don't create session until something stored
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true,               // Cookie not accessible via JavaScript
        maxAge: 24 * 60 * 60 * 1000   // Cookie expires after 24 hours
    }
}));

/**
 * MySQL Database Connection Pool
 * 
 * Creates a connection pool for MySQL database access using environment variables.
 * Connection pooling improves performance by reusing connections.
 */
const mysql = require('mysql2/promise');
const pool = mysql.createPool({
    host: process.env.DB_HOST,        // Database host from environment variables
    user: process.env.DB_USER,        // Database username
    password: process.env.DB_PASSWORD, // Database password
    database: process.env.DB_NAME,    // Database name
    port: process.env.DB_PORT || 3306, // Database port (default: 3306)
});

/**
 * Registration Route
 * 
 * This endpoint handles user registration for both students and coordinators.
 * It validates required fields, hashes passwords securely, and stores user data
 * in the appropriate database table based on the role.
 */
app.post('/register', async (req, res) => {
    try {
        console.log("Form submission:", req.body);
        const { role, first_name, last_name, email, phone, username, password } = req.body;

        // Check for missing required fields and compile a list
        const missingFields = [];
        if (!role) missingFields.push('role');
        if (!first_name) missingFields.push('first_name');
        if (!last_name) missingFields.push('last_name');
        if (!email) missingFields.push('email');
        if (!phone) missingFields.push('phone');
        if (!username) missingFields.push('username');
        if (!password) missingFields.push('password');
        
        // Return error with list of missing fields if any are missing
        if (missingFields.length > 0) {
            console.log("Missing fields:", missingFields);
            return res.status(400).json({ 
                message: 'All fields are required', 
                missingFields: missingFields 
            });
        }

        // Validate required fields
        if (!role || !first_name || !last_name || !email || !phone || !username || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (!role || (role.toLowerCase() !== 'student' && role.toLowerCase() !== 'coordinator')) {
            return res.status(400).json({ message: 'Invalid role selected' });
        }

        const userRole = role.toLowerCase();

        // Query template based on role with backticks around column names for case sensitivity
        const query = userRole === 'student'
            ? `INSERT INTO students (\`first_name\`, \`last_name\`, \`email\`, \`phone\`, \`username\`, \`password\`) VALUES (?, ?, ?, ?, ?, ?)`
            : `INSERT INTO coordinators (\`first_name\`, \`last_name\`, \`email\`, \`phone\`, \`username\`, \`password\`) VALUES (?, ?, ?, ?, ?, ?)`;

        console.log("Executing query:", query);
        console.log("With values:", [first_name, last_name, email, phone, username, "HASHED_PASSWORD"]);

        const connection = await pool.getConnection();

        try {
            // Hash the password before storing
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Execute the query with parameters in the correct order
            const [result] = await connection.query(query, [first_name, last_name, email, phone, username, hashedPassword]);
            
            console.log("DB Insert result:", result);
            
            // Return JSON response with success status
            return res.status(200).json({ 
                success: true, 
                message: "Registration successful",
                redirectUrl: userRole === 'student' ? '/loginStudent' : '/loginCoordinator'
            });
        } catch (err) {
            console.error("Database error details:", err.code, err.sqlMessage || err.message);
            
            // Provide more specific error messages based on common SQL errors
            if (err.code === 'ER_DUP_ENTRY') {
                // Extract the duplicate field from error message for more precise feedback
                let field = 'a field';
                let fieldValue = '';
                
                if (err.sqlMessage) {
                    // Extract the value causing the duplicate entry
                    const valueMatch = err.sqlMessage.match(/'([^']+)'/);
                    if (valueMatch && valueMatch[1]) {
                        fieldValue = valueMatch[1];
                        
                        // Try to identify which column based on the value or error message
                        if (err.sqlMessage.includes('email')) {
                            field = 'email';
                        } else if (err.sqlMessage.includes('phone')) {
                            field = 'phone';
                        } else if (err.sqlMessage.includes('username')) {
                            field = 'username';
                        } else {
                            // Try to guess based on the format of the value
                            if (fieldValue.includes('@')) {
                                field = 'email';
                            } else if (/^\d+$/.test(fieldValue.replace(/[-()\s]/g, ''))) {
                                field = 'phone';
                            } else {
                                field = 'username';
                            }
                        }
                    }
                }
                              
                return res.status(400).json({ 
                    message: `Registration failed. The ${field} "${fieldValue}" you entered is already in use.`,
                    duplicateField: field
                });
            }
            
            return res.status(500).json({ 
                message: "Registration failed. Database error: " + (err.sqlMessage || err.message)
            });
        } finally {
            connection.release(); // Always release the connection
        }
    } catch (err) {
        console.error("Server error:", err);
        return res.status(500).json({ message: "An unexpected error occurred: " + err.message });
    }
});

// This endpoint checks if a username, email, or phone number is available for registration
app.get('/api/check-availability', async (req, res) => {
    try {
        const { field, value } = req.query;
        
        if (!field || !value || !['username', 'email', 'phone'].includes(field)) {
            return res.status(400).json({ valid: false, message: 'Invalid request' });
        }
        
        const connection = await pool.getConnection();
        
        try {
            // Query both students and coordinators tables
            const [studentRows] = await connection.execute(
                `SELECT * FROM students WHERE ${field} = ?`,
                [value]
            );
            
            const [coordinatorRows] = await connection.execute(
                `SELECT * FROM coordinators WHERE ${field} = ?`,
                [value]
            );
            
            const isAvailable = studentRows.length === 0 && coordinatorRows.length === 0;
            
            return res.json({
                valid: isAvailable,
                message: isAvailable ? `${field} is available` : `This ${field} is already in use`
            });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error checking field availability:', err);
        return res.status(500).json({ 
            valid: false, 
            message: 'Server error while checking availability' 
        });
    }
});

/**
 * Store Quiz Violation Frame API Endpoint
 * 
 * This endpoint receives webcam violation frames and stores them in the database.
 * It accepts quiz_id, student_username, violation_type, timestamp, and frame_data (base64 encoded).
 */
app.post('/api/quiz/store-violation-frame', async (req, res) => {
    try {
        const { quiz_id, student_username, violation_type, frame_data, timestamp } = req.body;
        
        // Validate required fields
        if (!quiz_id || !student_username || !violation_type || !frame_data) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields for storing violation frame' 
            });
        }
        
        // Insert the frame data into the database
        const query = `
            INSERT INTO quiz_violation_frames 
            (quiz_id, student_username, violation_type, timestamp, frame_data) 
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const frameTimestamp = timestamp || new Date().toISOString();
        
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.query(query, [
                quiz_id, 
                student_username, 
                violation_type,
                frameTimestamp,
                frame_data
            ]);
            
            return res.status(200).json({ 
                success: true, 
                message: "Violation frame stored successfully",
                frameId: result.insertId
            });
        } catch (err) {
            console.error("Database error storing violation frame:", err);
            return res.status(500).json({ 
                success: false,
                message: "Failed to store violation frame in database: " + (err.sqlMessage || err.message)
            });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error("Server error handling violation frame:", err);
        return res.status(500).json({ 
            success: false,
            message: "An unexpected error occurred processing the violation frame: " + err.message 
        });
    }
});

/**
 * Get Quiz Violation Frames API Endpoint
 * 
 * This endpoint retrieves webcam violation frames from the database for a specific quiz and student.
 * It supports optional filtering by violation type and timestamp range.
 */
app.get('/api/quiz/get-violation-frames', async (req, res) => {
    try {
        const { quiz_id, student_username, violation_type, start_date, end_date } = req.query;
        
        // Validate required fields
        if (!quiz_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Quiz ID is required' 
            });
        }
        
        // Build the query with conditional filters
        let query = `
            SELECT id, quiz_id, student_username, violation_type, timestamp, 
                   frame_data, incident_count, created_at
            FROM quiz_violation_frames
            WHERE quiz_id = ?
        `;
        
        const queryParams = [quiz_id];
        
        // Add optional filters
        if (student_username) {
            query += ` AND student_username = ?`;
            queryParams.push(student_username);
        }
        
        if (violation_type) {
            query += ` AND violation_type = ?`;
            queryParams.push(violation_type);
        }
        
        if (start_date) {
            query += ` AND timestamp >= ?`;
            queryParams.push(start_date);
        }
        
        if (end_date) {
            query += ` AND timestamp <= ?`;
            queryParams.push(end_date);
        }
        
        // Order by timestamp
        query += ` ORDER BY timestamp DESC`;
        
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(query, queryParams);
            
            return res.status(200).json({ 
                success: true, 
                message: "Violation frames retrieved successfully",
                data: rows
            });
        } catch (err) {
            console.error("Database error retrieving violation frames:", err);
            return res.status(500).json({ 
                success: false,
                message: "Failed to retrieve violation frames: " + (err.sqlMessage || err.message)
            });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error("Server error retrieving violation frames:", err);
        return res.status(500).json({ 
            success: false,
            message: "An unexpected error occurred retrieving violation frames: " + err.message 
        });
    }
});

// Login route for students
app.post("/loginStudent", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required" });
        }

        const connection = await pool.getConnection();
        
        try {
            const [rows] = await connection.execute(`SELECT * FROM students WHERE username = ?`, [username]);

            if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].password))) {
                return res.status(400).json({ message: "Invalid username or password" });
            }

            // Set user in session
            req.session.user = {
                id: rows[0].username,
                role: 'student',
                firstName: rows[0].first_name,
                lastName: rows[0].last_name
            };

            return res.redirect('/studentDashboard');
        } catch (error) {
            console.error("Database error:", error);
            return res.status(500).json({ message: "Login failed. Please try again later." });
        } finally {
            connection.release(); // Always release the connection
        }
    } catch (error) {
        console.error("Server error:", error);
        return res.status(500).json({ message: "An unexpected error occurred" });
    }
});

// Login route for coordinators
app.post("/loginCoordinator", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required" });
        }

        const connection = await pool.getConnection();
        
        try {
            const [rows] = await connection.execute(`SELECT * FROM coordinators WHERE username = ?`, [username]);

            if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].password))) {
                return res.status(400).json({ message: "Invalid username or password" });
            }

            // Set user in session instead of using query parameters
            req.session.user = {
                id: rows[0].username,
                role: 'coordinator',
                firstName: rows[0].first_name,
                lastName: rows[0].last_name
            };

            return res.redirect('/coordinatorDashboard');
        } catch (error) {
            console.error("Database error:", error);
            return res.status(500).json({ message: "Login failed. Please try again later." });
        } finally {
            connection.release(); // Always release the connection
        }
    } catch (error) {
        console.error("Server error:", error);
        return res.status(500).json({ message: "An unexpected error occurred" });
    }
});

/**
 * ===============================
 * FACE DETECTION & MONITORING
 * ===============================
 * 
 * This section handles face detection and monitoring during exams.
 * It uses a separate Python service for webcam-based face detection.
 */
 
// Import face monitoring service module
const faceMonitorService = require('./face_monitor_service');

/**
 * Start face monitoring for a quiz session
 * 
 * This endpoint initiates webcam-based face monitoring when a student begins an exam.
 * It creates a unique session ID for monitoring and returns the WebSocket port for frontend connection.
 */
app.post('/api/quiz/:id/start-monitoring', isAuthenticated, async (req, res) => {
    // Verify the user is a student
    if (req.session.user.role !== 'student') {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const quizId = req.params.id;
    const sessionId = `${req.session.user.id}_${quizId}`; // Create unique session identifier
    
    try {
        // Start the face monitoring service process
        const monitoringInfo = await faceMonitorService.startMonitoringSession(sessionId);
        
        // Record monitoring session in database for reporting and analytics
        await recordMonitoringSession(quizId, req.session.user.id, monitoringInfo.websocketPort);
        
        // Return WebSocket port for frontend to connect to monitoring service
        return res.status(200).json({
            success: true,
            websocketPort: monitoringInfo.websocketPort
        });
    } catch (err) {
        console.error('Error starting face monitoring:', err);
        return res.status(500).json({ message: 'Failed to start monitoring: ' + err.message });
    }
});

/**
 * Stop face monitoring for a quiz session
 * 
 * This endpoint terminates the face monitoring process when a student completes or exits an exam.
 * It cleans up resources and closes the WebSocket connection.
 */
app.post('/api/quiz/:id/stop-monitoring', isAuthenticated, async (req, res) => {
    // Verify the user is a student
    if (req.session.user.role !== 'student') {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const quizId = req.params.id;
    const sessionId = `${req.session.user.id}_${quizId}`; // Use the same session ID format
    
    try {
        // Tell the face monitoring service to stop this monitoring session
        const result = await faceMonitorService.stopMonitoringSession(sessionId);
        
        // Return success status and message
        return res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (err) {
        console.error('Error stopping face monitoring:', err);
        return res.status(500).json({ message: 'Failed to stop monitoring: ' + err.message });
    }
});

// Add security issue endpoint to record face monitoring violations
/**
 * Add security issue endpoint to record face monitoring violations
 * 
 * This endpoint specifically handles face monitoring issues like:
 * - Student looking away from the screen
 * - Absence of face in camera
 * - Multiple faces detected
 * 
 * Unlike general security issues, this tracks duration of violations
 */
app.post('/api/quiz/face-monitoring-issue', isAuthenticated, async (req, res) => {
    // Verify the user is a student
    if (req.session.user.role !== 'student') {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Extract data about the face monitoring violation
    const { quizId, issueType, awayDuration, timestamp } = req.body;
    
    try {
        const connection = await pool.getConnection();
        try {
            // Use the timestamp provided or current time if not provided
            const now = timestamp ? new Date(timestamp) : new Date();
            const formattedDate = now.toISOString().slice(0, 19).replace('T', ' ');
            
            // Record the face monitoring issue with details about away duration
            await connection.execute(
                'INSERT INTO quiz_security_logs (quiz_id, student_username, issue_type, details, timestamp) VALUES (?, ?, ?, ?, ?)',
                [quizId, req.session.user.id, issueType, `Looking away for ${awayDuration} seconds`, formattedDate]
            );
            
            // Return success response
            return res.status(200).json({ success: true });
        } finally {
            connection.release(); // Always release the connection back to the pool
        }
    } catch (err) {
        console.error('Error recording face monitoring issue:', err);
        return res.status(500).json({ message: 'Failed to record issue: ' + err.message });
    }
});

/**
 * Helper function to record monitoring session in database
 * 
 * This function records when a face monitoring session begins,
 * which port it's using, and which student/quiz it's associated with.
 * 
 * @param {number} quizId - The ID of the quiz being monitored
 * @param {string} studentId - The ID/username of the student taking the quiz
 * @param {number} port - The WebSocket port used for the monitoring connection
 */
async function recordMonitoringSession(quizId, studentId, port) {
    try {
        // Get database connection from pool
        const connection = await pool.getConnection();
        try {
            // Check if the monitoring_sessions table exists in the database
            const [tables] = await connection.query(`
                SELECT TABLE_NAME 
                FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'monitoring_sessions'
            `, [process.env.DB_NAME]);
            
            // Create the table if it doesn't exist
            if (tables.length === 0) {
                await connection.query(`
                    CREATE TABLE monitoring_sessions (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        quiz_id INT NOT NULL,
                        student_username VARCHAR(100) NOT NULL,
                        websocket_port INT NOT NULL,
                        started_at DATETIME NOT NULL,
                        ended_at DATETIME NULL,
                        INDEX (quiz_id),
                        INDEX (student_username)
                    )
                `);
            }
            
            // Insert the monitoring session record
            await connection.execute(
                'INSERT INTO monitoring_sessions (quiz_id, student_username, websocket_port, started_at) VALUES (?, ?, ?, NOW())',
                [quizId, studentId, port]
            );
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error recording monitoring session:', err);
        // Continue even if recording fails
    }
}

// End of face detection logic //

// API endpoint to get available quizzes for students -- provides a list/overview of quizzes available to students
app.get('/api/availableQuizzes', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'student') {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            // Get all active quizzes INCLUDING deadline_date
            const [quizzes] = await connection.execute(
                `SELECT q.id, q.title, q.description, q.scheduled_date, q.deadline_date,
                 c.first_name, c.last_name
                 FROM quizzes q
                 JOIN coordinators c ON q.created_by = c.username
                 WHERE q.is_active = TRUE
                 ORDER BY q.scheduled_date DESC`
            );
            
            // Check if student has already taken each quiz
            const studentId = req.session.user.id;
            for (let quiz of quizzes) {
                const [results] = await connection.execute(
                    'SELECT * FROM quiz_attempts WHERE quiz_id = ? AND student_username = ?',
                    [quiz.id, studentId]
                );
                quiz.attempted = results.length > 0;
                
                // If attempted, get the score
                if (quiz.attempted && results.length > 0) {
                    quiz.marks_obtained = results[0].score;
                    quiz.total_marks = results[0].total_questions;
                }
            }
            
            res.json(quizzes);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error fetching available quizzes:', err);
        res.status(500).json({ message: 'Failed to load available quizzes' });
    }
});

// API endpoint for student statistics
app.get('/api/student/stats', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'student') {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            const username = req.session.user.id;
            
            // Get completed quizzes count
            const [completedQuizzes] = await connection.execute(
                'SELECT COUNT(*) as count FROM quiz_attempts WHERE student_username = ?',
                [username]
            );
            
            // Get pending quizzes count (active quizzes not yet attempted)
            const [pendingQuizzes] = await connection.execute(
                `SELECT COUNT(*) as count FROM quizzes 
                 WHERE is_active = TRUE 
                 AND id NOT IN (
                     SELECT quiz_id FROM quiz_attempts WHERE student_username = ?
                 )`,
                [username]
            );
            
            // Get average score
            const [avgScore] = await connection.execute(
                `SELECT AVG(score / total_questions * 100) as average 
                 FROM quiz_attempts 
                 WHERE student_username = ?`,
                [username]
            );
            
            // Get highest score
            const [highestScore] = await connection.execute(
                `SELECT MAX(score / total_questions * 100) as highest 
                 FROM quiz_attempts 
                 WHERE student_username = ?`,
                [username]
            );
            
            res.json({
                completedQuizzes: completedQuizzes[0].count,
                pendingQuizzes: pendingQuizzes[0].count,
                averageScore: avgScore[0].average || 0,
                highestScore: highestScore[0].highest || 0
            });
            
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error fetching student stats:', err);
        res.status(500).json({ message: 'Failed to fetch student statistics' });
    }
});

// API endpoint to get quiz data for students -- provides the detailed content of a specific quiz when a student wants to take it
app.get('/api/quiz/:id', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'student') {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const quizId = req.params.id;
    
    try {
        const connection = await pool.getConnection();
        try {
            // Check if quiz exists and is active
            const [quizzes] = await connection.execute(
                'SELECT id, title, description, duration, scheduled_date FROM quizzes WHERE id = ? AND is_active = TRUE',
                [quizId]
            );
            
            if (quizzes.length === 0) {
                return res.status(404).json({ message: 'Quiz not found or not available' });
            }
            
            const quiz = quizzes[0];
            
            // Check if student has already taken this quiz
            const [attempts] = await connection.execute(
                'SELECT * FROM quiz_attempts WHERE quiz_id = ? AND student_username = ?',
                [quizId, req.session.user.id]
            );
            
            if (attempts.length > 0) {
                return res.status(400).json({ message: 'You have already taken this quiz' });
            }
            
            // Get all questions for this quiz
            const [questions] = await connection.execute(
                'SELECT id, question_text FROM questions WHERE quiz_id = ?',
                [quizId]
            );
            
            // Get all options for these questions (excluding is_correct)
            for (let question of questions) {
                const [options] = await connection.execute(
                    'SELECT id, option_text FROM options WHERE question_id = ?',
                    [question.id]
                );
                question.options = options;
            }
            
            // Create a quiz session record
            await connection.execute(
                'INSERT INTO quiz_sessions (quiz_id, student_username, started_at) VALUES (?, ?, NOW())',
                [quizId, req.session.user.id]
            );
            // In your server.js or similar file
    async function initDatabase() {
        try {
            // Check if the table exists
            const [tables] = await pool.query(`
                SELECT TABLE_NAME 
                FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = 'pragati' AND TABLE_NAME = 'quiz_security_logs'
            `);
            
                // Create table if it doesn't exist
                if (tables.length === 0) {
                    await pool.query(`
                        CREATE TABLE quiz_security_logs (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            quiz_id INT NOT NULL,
                            student_username VARCHAR(100) NOT NULL,
                            issue_type VARCHAR(50) NOT NULL,
                            timestamp DATETIME NOT NULL,
                            details TEXT,
                            INDEX (quiz_id),
                            INDEX (student_username)
                        )
                    `);
                    console.log("Created quiz_security_logs table");
                }
            } catch (err) {
                console.error("Database initialization error:", err);
            }
        }

    // Call this when your server starts
    initDatabase();
                
                // Return the quiz data
                res.json({
                    id: quiz.id,
                    title: quiz.title,
                    description: quiz.description,
                    duration: quiz.duration || 30, // Default 30 minutes if not specified
                    questions: questions
                });
                
            } finally {
                connection.release();
            }
        } catch (err) {
            console.error('Error loading quiz:', err);
            res.status(500).json({ message: 'Failed to load quiz' });
        }
    });

/**
 * API endpoint to get quiz duration for students during quiz taking
 * 
 * This endpoint is called by the frontend to determine how much time
 * a student has to complete the quiz, which is used for the countdown timer.
 */
app.get('/api/quizzes/:quizId/duration', isAuthenticated, async (req, res) => {
    try {
        const quizId = req.params.quizId; // Extract quiz ID from URL parameter
        
        // Get connection from the database pool
        const connection = await pool.getConnection();
        
        try {
            // Query to get the duration of this specific quiz
            const [rows] = await connection.execute(
                'SELECT duration FROM quizzes WHERE id = ?',
                [quizId]
            );
            
            // Check if quiz exists in database
            if (rows.length === 0) {
                return res.status(404).json({ message: 'Quiz not found' });
            }
            
            // Return just the duration value to the frontend
            return res.json({ duration: rows[0].duration });
            
        } finally {
            connection.release(); // Always release the connection back to the pool
        }
    } catch (err) {
        console.error('Error fetching quiz duration:', err);
        return res.status(500).json({ 
            message: 'An error occurred while fetching quiz duration' 
        });
    }
});

/**
 * Quiz submission endpoint
 * 
 * This endpoint handles the submission of completed quizzes, including:
 * - Automatic submissions due to time expiration or security violations
 * - Manual submissions by the student
 * - Handling of unanswered questions
 * - Scoring the quiz based on correct answers
 */
app.post('/api/quiz/:id/submit', isAuthenticated, async (req, res) => {
    // Only students can submit quizzes
    if (req.session.user.role !== 'student') {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const quizId = req.params.id; // Extract quiz ID from URL parameter
    const { answers, autoSubmitted, allQuestionIds } = req.body; // Extract submission data
    
    try {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            // Check if quiz exists and is active
            const [quizzes] = await connection.execute(
                'SELECT * FROM quizzes WHERE id = ? AND is_active = TRUE',
                [quizId]
            );
            
            if (quizzes.length === 0) {
                return res.status(404).json({ message: 'Quiz not found or not available' });
            }
            
            // Check if student has already submitted this quiz
            const [attempts] = await connection.execute(
                'SELECT * FROM quiz_attempts WHERE quiz_id = ? AND student_username = ?',
                [quizId, req.session.user.id]
            );
            
            if (attempts.length > 0) {
                return res.status(400).json({ message: 'You have already submitted this quiz' });
            }
            
            // Get all questions for this quiz to handle unanswered questions
            const [allQuestions] = await connection.execute(
                'SELECT id FROM questions WHERE quiz_id = ?',
                [quizId]
            );
            
            // Convert to array of question IDs
            const quizQuestionIds = allQuestions.map(q => q.id.toString());
            
            // Create a map of answered questions
            const answeredQuestionsMap = {};
            for (const answer of answers) {
                answeredQuestionsMap[answer.questionId] = answer.optionId;
            }
            
            // Calculate score
            let score = 0;
            let totalQuestions = quizQuestionIds.length;
            
            // Save attempt with auto-submission flag
            const [result] = await connection.execute(
                'INSERT INTO quiz_attempts (quiz_id, student_username, score, total_questions, completed_date, auto_submitted) VALUES (?, ?, ?, ?, NOW(), ?)',
                [quizId, req.session.user.id, 0, totalQuestions, autoSubmitted ? 1 : 0]
            );
            
            const attemptId = result.insertId;
            
            // Process all quiz questions (both answered and unanswered)
            for (const questionId of quizQuestionIds) {
                if (answeredQuestionsMap[questionId]) {
                    // This question was answered
                    const [options] = await connection.execute(
                        'SELECT is_correct FROM options WHERE id = ?',
                        [answeredQuestionsMap[questionId]]
                    );
                    
                    if (options.length > 0 && options[0].is_correct) {
                        score++;
                    }
                    
                    // Save the selected answer
                    await connection.execute(
                        'INSERT INTO quiz_answers (attempt_id, question_id, option_id) VALUES (?, ?, ?)',
                        [attemptId, questionId, answeredQuestionsMap[questionId]]
                    );
                } else {
                    // This question was NOT answered - find a valid incorrect option to record
                    // This approach ensures we don't violate foreign key constraints
                    const [incorrectOptions] = await connection.execute(
                        'SELECT id FROM options WHERE question_id = ? AND is_correct = FALSE LIMIT 1',
                        [questionId]
                    );
                    
                    if (incorrectOptions.length > 0) {
                        // Record an incorrect option (scoring already accounts for this being incorrect)
                        await connection.execute(
                            'INSERT INTO quiz_answers (attempt_id, question_id, option_id) VALUES (?, ?, ?)',
                            [attemptId, questionId, incorrectOptions[0].id]
                        );
                    }
                    // If we couldn't find a valid incorrect option, we'll skip recording this answer
                }
            }
            
            // Update the score in the attempt record
            await connection.execute(
                'UPDATE quiz_attempts SET score = ? WHERE id = ?',
                [score, attemptId]
            );
            
            // Update the quiz session record
            await connection.execute(
                'UPDATE quiz_sessions SET completed_at = NOW(), auto_submitted = ? WHERE quiz_id = ? AND student_username = ? AND completed_at IS NULL',
                [autoSubmitted ? 1 : 0, quizId, req.session.user.id]
            );
            
            await connection.commit();
            
            return res.status(200).json({
                success: true,
                message: 'Quiz submitted successfully',
                score: score,
                total: totalQuestions,
                autoSubmitted: autoSubmitted
            });
        } catch (err) {
            await connection.rollback();
            console.error('Error submitting quiz:', err);
            return res.status(500).json({ message: 'Failed to submit quiz: ' + err.message });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred' });
    }
});

/**
 * API endpoint to create a new quiz
 * 
 * This endpoint allows coordinators to create quizzes with questions and options.
 * It handles validation of quiz data, scheduled dates, and storing in the database.
 * All question and answer data is validated before saving.
 */
app.post('/api/quizzes', isAuthenticated, async (req, res) => {
    try {
        // Verify the user is a coordinator
        if (req.session.user.role !== 'coordinator') {
            return res.status(403).json({ message: 'Only coordinators can create quizzes' });
        }

        // Extract quiz data from request body
        const { title, description, questions, scheduledDate, deadlineDate, duration } = req.body;

        // Validate that required fields are present and properly formatted
        if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ message: 'Title and at least one question are required' });
        }        // Parse and validate scheduled start date if provided
        let parsedScheduledDate = null;
        if (scheduledDate) {
            parsedScheduledDate = new Date(scheduledDate);
            if (isNaN(parsedScheduledDate.getTime())) {
                return res.status(400).json({ message: 'Invalid scheduled date format' });
            }
        }
        
        // Parse and validate deadline date if provided
        let parsedDeadlineDate = null;
        if (deadlineDate) {
            parsedDeadlineDate = new Date(deadlineDate);
            if (isNaN(parsedDeadlineDate.getTime())) {
                return res.status(400).json({ message: 'Invalid deadline date format' });
            }
        }
        
        // Ensure deadline is chronologically after the scheduled start date
        if (parsedScheduledDate && parsedDeadlineDate && parsedDeadlineDate <= parsedScheduledDate) {
            return res.status(400).json({ message: 'Deadline must be after the scheduled date' });
        }        // Get database connection from pool
        const connection = await pool.getConnection();
        
        try {
            // Begin database transaction for data integrity
            await connection.beginTransaction();
            
            // Insert the main quiz record into the database
            const [quizResult] = await connection.execute(
                'INSERT INTO quizzes (title, description, created_by, scheduled_date, deadline_date, duration, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    title,                          // Quiz title
                    description || '',              // Quiz description (empty string if not provided)
                    req.session.user.id,            // Creator's username
                    parsedScheduledDate,            // When the quiz becomes available
                    parsedDeadlineDate,             // When the quiz closes
                    duration || 30,                 // Quiz duration in minutes (default: 30)
                    parsedScheduledDate ? false : true // Quiz is active immediately if no scheduled date
                ]
            );
              const quizId = quizResult.insertId; // Get the ID of the newly created quiz
            
            // Insert all questions for this quiz
            for (const question of questions) {
                // Validate question format
                if (!question.text || !question.options || !Array.isArray(question.options)) {
                    throw new Error('Invalid question format');
                }
                
                // Insert the question into the database
                const [questionResult] = await connection.execute(
                    'INSERT INTO questions (quiz_id, question_text) VALUES (?, ?)',
                    [quizId, question.text]
                );
                
                const questionId = questionResult.insertId; // Get the ID of the newly created question
                
                // Insert all options for this question
                for (const option of question.options) {
                    // Skip options without text
                    if (!option.text) continue;
                    
                    // Insert the option into the database
                    await connection.execute(
                        'INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)',
                        [questionId, option.text, option.isCorrect ? 1 : 0] // Convert boolean to 1/0 for MySQL
                    );
                }
            }
              // Commit transaction to finalize database changes
            await connection.commit();
            
            // Return success response with the created quiz ID
            return res.status(201).json({ 
                success: true,
                message: 'Quiz created successfully',
                quizId: quizId
            });
            
        } catch (err) {
            // Rollback transaction on error to maintain data integrity
            await connection.rollback();
            console.error('Database error:', err);
            return res.status(500).json({ 
                message: 'Error creating quiz: ' + err.message 
            });
        } finally {
            // Always release the connection back to the pool
            connection.release();
        }
    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ 
            message: 'An unexpected error occurred: ' + err.message 
        });
    }
});

/**
 * Log security issues during quiz
 * 
 * This endpoint records security violations during quiz attempts such as:
 * - Tab switching attempts
 * - Right-click attempts
 * - Fullscreen exit
 * - Developer tools usage
 * - Copy/paste attempts
 * - Other integrity violations
 * 
 * Security logs are stored in the database for later review by coordinators.
 */
app.post('/api/quiz/security-issue', async (req, res) => {
    const { quizId, issueType, timestamp } = req.body; // Extract data from request body
    
    try {
        // Validate that all required parameters are present
        if (!quizId || !issueType || !timestamp) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required parameters: quizId, issueType, and timestamp are all required' 
            });
        }
        
        // Convert ISO string to MySQL datetime format for database storage
        const dateObj = new Date(timestamp);
        const mysqlTimestamp = dateObj.toISOString().slice(0, 19).replace('T', ' ');
        
        // Insert security violation record directly using the connection pool
        await pool.execute(
            'INSERT INTO quiz_security_logs (quiz_id, student_username, issue_type, timestamp) VALUES (?, ?, ?, ?)',
            [quizId, req.session.user.id, issueType, mysqlTimestamp]
        );
        
        // Return success response
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error logging security issue:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Protected routes
// Home route
app.get('/', (req, res) => {
    res.render('homepage'); // Rendering the homepage
});

// Registration route for students and coordinators
app.get('/register', (req, res) => {
    res.render('register'); // Rendering the registration page
});

// Login route for students
app.get('/loginStudent', (req, res) => {
    // Double check that the template file exists at this path
    res.render('loginStudent'); // This looks for views/loginStudent.ejs
});

// Login route for coordinators
app.get('/loginCoordinator', (req, res) => {
    // Double check that the template file exists at this path
    res.render('loginCoordinator'); // This looks for views/loginCoordinator.ejs 
});

/**
 * Student Dashboard Route
 * 
 * This route renders the student dashboard page, showing:
 * - Available quizzes
 * - Completed quizzes
 * - Student statistics
 * - Navigation options
 */
app.get('/studentDashboard', isAuthenticated, (req, res) => {
    // Verify the user is a student, redirect to homepage if not
    if (req.session.user.role !== 'student') {
        return res.redirect('/');
    }
    
    // Render the student dashboard with user information
    res.render('studentDashboard', { user: req.session.user });
});

/**
 * Coordinator Dashboard Route
 * 
 * This route renders the coordinator dashboard page, showing:
 * - Created quizzes
 * - Quiz statistics
 * - Student performance data
 * - Quiz management options
 */
app.get('/coordinatorDashboard', isAuthenticated, (req, res) => {
    // Verify the user is a coordinator, redirect to homepage if not
    if (req.session.user.role !== 'coordinator') {
        return res.redirect('/');
    }
    
    // Render the coordinator dashboard with user information
    res.render('coordinatorDashboard', { user: req.session.user });
});
// Dashboard stats API endpoint for coordinators
app.get('/api/dashboard-stats', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'coordinator') {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            // Get coordinator's username
            const username = req.session.user.id;
            
            // Get total quizzes created by this coordinator
            const [totalQuizzes] = await connection.execute(
                'SELECT COUNT(*) as count FROM quizzes WHERE created_by = ?',
                [username]
            );
            
            // Get active quizzes
            const [activeQuizzes] = await connection.execute(
                'SELECT COUNT(*) as count FROM quizzes WHERE created_by = ? AND is_active = TRUE',
                [username]
            );
            
            // Get total quiz attempts for quizzes created by this coordinator
            const [totalAttempts] = await connection.execute(
                `SELECT COUNT(*) as count FROM quiz_attempts qa
                 JOIN quizzes q ON qa.quiz_id = q.id
                 WHERE q.created_by = ?`,
                [username]
            );
            
            // Get average score across all attempts
            const [avgScore] = await connection.execute(
                `SELECT AVG(score / total_questions * 100) as average FROM quiz_attempts qa
                 JOIN quizzes q ON qa.quiz_id = q.id
                 WHERE q.created_by = ?`,
                [username]
            );
            
            res.json({
                totalQuizzes: totalQuizzes[0].count,
                activeQuizzes: activeQuizzes[0].count,
                totalAttempts: totalAttempts[0].count,
                averageScore: avgScore[0].average ? Math.round(avgScore[0].average) : 0
            });
            
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
    }
});
// In your route handler that renders takeQuiz.ejs
app.get('/takeQuiz', (req, res) => {
    // ...other data preparation...
    res.render('takeQuiz', {
      user: user,
      quiz: quiz,
      questions: questions,
      csrfToken: req.csrfToken() // Add this line to pass the token
    });
  });

// Route to create a quiz (only accessible by coordinators)
app.get('/createQuiz', isAuthenticated, (req, res) => {
    if (req.session.user.role !== 'coordinator') {
        return res.redirect('/');
    }
    res.render('createQuiz', { user: req.session.user });
});
app.get('/viewQuizzes', isAuthenticated, (req, res) => {
    if (req.session.user.role !== 'coordinator') {
        return res.redirect('/');
    }
    res.render('viewQuizzes', { user: req.session.user });
});
/**
 * Scheduled Quiz Activation Job
 * 
 * This cron job runs every minute to automatically activate quizzes
 * when their scheduled start time is reached. It changes the 'is_active'
 * flag so students can access the quiz when the scheduled time arrives.
 * 
 * Cron pattern: '* * * * *' = run every minute
 */
cron.schedule('* * * * *', async () => {
    console.log('Running scheduled quiz activation check...');
    try {
        // Get database connection from pool
        const connection = await pool.getConnection();
        try {
            // Find and update quizzes where scheduled date has passed but they're not active yet
            const [quizzes] = await connection.execute(
                'UPDATE quizzes SET is_active = TRUE WHERE scheduled_date <= NOW() AND is_active = FALSE'
            );
            
            // Log the activation if any quizzes were activated
            if (quizzes.affectedRows > 0) {
                console.log(`Automatically activated ${quizzes.affectedRows} quiz(es) at ${new Date().toISOString()}`);
            }
        } catch (err) {
            console.error('Error in quiz activation job:', err);
        } finally {
            connection.release(); // Always release the database connection
        }
    } catch (err) {
        console.error('Failed to get database connection for quiz activation job:', err);
    }
});

/**
 * Logout route
 * 
 * Handles user logout by destroying their session and redirecting to homepage.
 * This endpoint is used by both students and coordinators.
 */
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/'); // Redirect to homepage after logout
    });
});

// Route to show available quizzes to students
app.get('/availableQuizzes', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'student') {
        return res.redirect('/');
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            // Get all active quizzes
            const [quizzes] = await connection.execute(
                `SELECT q.id, q.title, q.description, q.scheduled_date, 
                 c.first_name, c.last_name
                 FROM quizzes q
                 JOIN coordinators c ON q.created_by = c.username
                 WHERE q.is_active = TRUE
                 ORDER BY q.scheduled_date DESC`
            );
            
            // Check if student has already taken each quiz
            const studentId = req.session.user.id;
            for (let quiz of quizzes) {
                const [results] = await connection.execute(
                    'SELECT * FROM quiz_attempts WHERE quiz_id = ? AND student_username = ?',
                    [quiz.id, studentId]
                );
                quiz.attempted = results.length > 0;
            }
            
            res.render('availableQuizzes', { 
                user: req.session.user,
                quizzes: quizzes
            });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error fetching available quizzes:', err);
        res.status(500).render('error', { 
            message: 'Failed to load available quizzes' 
        });
    }
});

/**
 * Route to take a specific quiz
 * 
 * This route renders the quiz-taking interface for a specific quiz ID.
 * It validates the quiz is active, checks if the student has already taken it,
 * and loads all questions and options for the quiz.
 */
app.get('/takeQuiz/:id', isAuthenticated, async (req, res) => {
    // Verify the user is a student
    if (req.session.user.role !== 'student') {
        return res.redirect('/'); // Redirect non-students to homepage
    }
    
    // Check if the request is coming from a mobile device
    const userAgent = req.headers['user-agent'] || '';
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent);
    
    // Block mobile users at the server level
    if (isMobileDevice) {
        // Render a mobile block page or redirect with a message
        return res.render('mobileBlocked', {
            user: req.session.user,
            message: 'Quizzes can only be taken on desktop or laptop computers.'
        });
    }
    
    const quizId = req.params.id; // Get quiz ID from URL parameter
    
    try {
        // Get database connection from pool
        const connection = await pool.getConnection();
        try {
            // Check if quiz exists and is active
            const [quizzes] = await connection.execute(
                'SELECT * FROM quizzes WHERE id = ? AND is_active = TRUE',
                [quizId]
            );
            
            // If quiz doesn't exist or isn't active, show error page
            if (quizzes.length === 0) {
                return res.status(404).render('error', { 
                    message: 'Quiz not found or not available' 
                });
            }
            
            const quiz = quizzes[0];
            
            // Check if student has already taken this quiz
            const [attempts] = await connection.execute(
                'SELECT * FROM quiz_attempts WHERE quiz_id = ? AND student_username = ?',
                [quizId, req.session.user.id]
            );
            
            // If student has already taken this quiz, show completion page
            if (attempts.length > 0) {
                return res.render('quizCompleted', {
                    user: req.session.user,
                    quiz: quiz,
                    attempt: attempts[0]
                });
            }
            
            // Get all questions for this quiz
            const [questions] = await connection.execute(
                'SELECT * FROM questions WHERE quiz_id = ?',
                [quizId]
            );
            
            // Get all options for these questions (without showing correct answers)
            for (let question of questions) {
                const [options] = await connection.execute(
                    'SELECT id, option_text FROM options WHERE question_id = ?',
                    [question.id]
                );
                question.options = options; // Attach options to each question
            }
            
            // Render the quiz-taking page with all necessary data
            res.render('takeQuiz', {
                user: req.session.user,      // Pass user information
                quiz: quiz,                  // Pass quiz details
                questions: questions,        // Pass questions with options
                duration: quiz.duration || 30 // Default to 30 minutes if not specified
            });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error loading quiz:', err);
        res.status(500).render('error', { 
            message: 'Failed to load quiz' 
        });
    }
});

// API endpoint to get quiz details by ID for coordinators for viewing/editing
app.get('/api/quizzes/:id', isAuthenticated, async (req, res) => {
    // Check if user is a coordinator
    if (req.session.user.role !== 'coordinator') {
        return res.status(403).json({ message: 'Unauthorized access' });
    }
    
    const quizId = req.params.id;
    
    try {
        const connection = await pool.getConnection();
        try {
            // Get basic quiz information
            const [quizzes] = await connection.execute(
                `SELECT q.id, q.title, q.description, q.scheduled_date, q.deadline_date, 
                q.duration, q.created_by, q.is_active, q.created_date
                FROM quizzes q
                WHERE q.id = ? AND q.created_by = ?`,
                [quizId, req.session.user.id]
            );
            
            if (quizzes.length === 0) {
                return res.status(404).json({ message: 'Quiz not found or you do not have permission to view it' });
            }
            
            const quiz = quizzes[0];
            
            // Get quiz questions
            const [questions] = await connection.execute(
                'SELECT id, question_text as text FROM questions WHERE quiz_id = ?',
                [quizId]
            );
            
            // Get options for each question
            for (let question of questions) {
                const [options] = await connection.execute(
                    'SELECT id, option_text as text, is_correct as isCorrect FROM options WHERE question_id = ?',
                    [question.id]
                );
                question.options = options;
            }
            
            // Get attempts statistics
            const [attempts] = await connection.execute(
                'SELECT COUNT(*) as count FROM quiz_attempts WHERE quiz_id = ?',
                [quizId]
            );
            
            const [completedAttempts] = await connection.execute(
                'SELECT COUNT(*) as count FROM quiz_attempts WHERE quiz_id = ? AND completed_date IS NOT NULL',
                [quizId]
            );
            
            const [avgScore] = await connection.execute(
                'SELECT AVG(score / total_questions * 100) as average FROM quiz_attempts WHERE quiz_id = ?',
                [quizId]
            );
            
            const [highestScore] = await connection.execute(
                'SELECT MAX(score / total_questions * 100) as highest FROM quiz_attempts WHERE quiz_id = ?',
                [quizId]
            );
            
            // Compile all data
            const quizData = {
                ...quiz,
                questions: questions,
                attempts: attempts[0].count,
                completedAttempts: completedAttempts[0].count,
                averageScore: avgScore[0].average,
                highestScore: highestScore[0].highest
            };
            
            res.json(quizData);
            
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error fetching quiz details:', err);
        res.status(500).json({ message: 'Failed to load quiz details' });
    }
});

// This endpoint will return quizzes that are active and have not been attempted by the student
app.get('/student/quizzes', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'student') {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            const [quizzes] = await connection.execute(
                `SELECT q.id, q.title, q.description, q.duration, q.scheduled_date,
                 (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.student_username = ?) as attempted
                 FROM quizzes q 
                 WHERE q.is_active = TRUE 
                 AND q.scheduled_date <= NOW()
                 ORDER BY q.scheduled_date DESC`,
                [req.session.user.username]
            );

            // Filter out already attempted quizzes
            const availableQuizzes = quizzes.filter(quiz => !quiz.attempted);

            res.json(availableQuizzes);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error fetching quizzes:', err);
        res.status(500).json({ message: 'Failed to load quizzes' });
    }
});

// API endpoint to get all quizzes for a coordinator for viewing/editing
app.get('/api/quizzes', isAuthenticated, async (req, res) => {
    // Check if user is a coordinator
    if (req.session.user.role !== 'coordinator') {
        return res.status(403).json({ message: 'Unauthorized access' });
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            // Get all quizzes created by this coordinator
            const [quizzes] = await connection.execute(
                `SELECT q.id, q.title, q.description, q.scheduled_date, q.deadline_date, 
                q.duration, q.is_active, q.created_date, 
                (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count
                FROM quizzes q
                WHERE q.created_by = ?
                ORDER BY q.created_date DESC`,
                [req.session.user.id]
            );
            
            res.json(quizzes);
            
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error fetching quizzes:', err);
        res.status(500).json({ message: 'Failed to load quizzes' });
    }
});

// API endpoint to delete a quiz for coordinators
app.delete('/api/quizzes/:id', isAuthenticated, async (req, res) => {
    // Check if user is a coordinator
    if (req.session.user.role !== 'coordinator') {
        return res.status(403).json({ message: 'Unauthorized access' });
    }
    
    const quizId = req.params.id;
    
    try {
        const connection = await pool.getConnection();
        try {
            // First check if the quiz belongs to this coordinator
            const [quizCheck] = await connection.execute(
                'SELECT id FROM quizzes WHERE id = ? AND created_by = ?',
                [quizId, req.session.user.id]
            );
            
            if (quizCheck.length === 0) {
                return res.status(404).json({ message: 'Quiz not found or you do not have permission to delete it' });
            }
            
            // Begin transaction
            await connection.beginTransaction();
            
            // Delete options for all questions in this quiz
            await connection.execute(
                `DELETE o FROM options o 
                 JOIN questions q ON o.question_id = q.id 
                 WHERE q.quiz_id = ?`,
                [quizId]
            );
            
            // Delete all questions for this quiz
            await connection.execute(
                'DELETE FROM questions WHERE quiz_id = ?',
                [quizId]
            );
            
            // Delete all attempts for this quiz
            await connection.execute(
                'DELETE FROM quiz_attempts WHERE quiz_id = ?',
                [quizId]
            );
            
            // Finally delete the quiz itself
            await connection.execute(
                'DELETE FROM quizzes WHERE id = ?',
                [quizId]
            );
            
            // Commit transaction
            await connection.commit();
            
            res.json({ message: 'Quiz deleted successfully' });
            
        } catch (err) {
            // Rollback in case of error
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error deleting quiz:', err);
        res.status(500).json({ message: 'Failed to delete quiz' });
    }
});

// API endpoint to get quiz results for coordinators
app.get('/api/quizzes/:id/results', isAuthenticated, async (req, res) => {
    const quizId = req.params.id;
    const connection = await pool.getConnection();
    
    try {
        // Debug logs to help identify issues
        console.log(`Fetching results for quiz ${quizId}`);
        console.log(`User ID: ${req.session.user.id}`);
        console.log(`User role: ${req.session.user.role}`);
        
        // Verify the quiz belongs to this coordinator
        const [quizCheck] = await connection.execute(
            'SELECT * FROM quizzes WHERE id = ? AND created_by = ?',
            [quizId, req.session.user.id]
        );
        
        console.log(`Quiz check results: ${quizCheck.length} records found`);
        
        // Get quiz details
        const [quizDetails] = await connection.execute(
            'SELECT title, description FROM quizzes WHERE id = ?',
            [quizId]
        );
        
        if (quizDetails.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Quiz not found' 
            });
        }
          // Get all quiz attempts for this quiz
        const [attempts] = await connection.execute(
            `SELECT qa.id, qa.student_username, s.first_name, s.last_name, 
            qa.score, qa.total_questions, qa.completed_date, qa.auto_submitted
            FROM quiz_attempts qa
            JOIN students s ON qa.student_username = s.username
            WHERE qa.quiz_id = ?
            ORDER BY qa.completed_date DESC`,
            [quizId]
        );
        
        // Calculate statistics
        let totalAttempts = attempts.length;
        let averageScore = 0;
        let highestScore = 0;
        
        if (totalAttempts > 0) {
            averageScore = attempts.reduce((sum, attempt) => sum + (attempt.score / attempt.total_questions * 100), 0) / totalAttempts;
            highestScore = Math.max(...attempts.map(attempt => (attempt.score / attempt.total_questions * 100)));
        }
          // Get violation counts for each attempt
        for (let attempt of attempts) {
            const [violations] = await connection.execute(
                `SELECT COUNT(*) as violationCount
                 FROM quiz_violation_frames
                 WHERE quiz_id = ? AND student_username = ?`,
                [quizId, attempt.student_username]
            );
            
            attempt.violationCount = violations[0].violationCount || 0;
        }
          // Format attempts with percentage scores
        const formattedAttempts = attempts.map(attempt => ({
            ...attempt,
            studentId: attempt.student_username,
            studentName: `${attempt.first_name} ${attempt.last_name}`,
            percentScore: ((attempt.score / attempt.total_questions) * 100).toFixed(2),
            formattedDate: new Date(attempt.completed_date).toLocaleString(),
            violationCount: attempt.violationCount
        }));
        
        res.json({
            success: true,
            quizTitle: quizDetails[0].title,
            quizDescription: quizDetails[0].description,
            statistics: {
                totalAttempts,
                averageScore: averageScore.toFixed(2),
                highestScore: highestScore.toFixed(2)
            },
            attempts: formattedAttempts
        });
        
    } catch (error) {
        console.error('Error fetching quiz results:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch quiz results' 
        });
    } finally {
        connection.release();
    }
});

// API endpoint to get quiz violation frames for coordinators
app.get('/api/quizzes/:id/violations', isAuthenticated, async (req, res) => {
    // Check if user is a coordinator
    if (req.session.user.role !== 'coordinator') {
        return res.status(403).json({ 
            success: false, 
            message: 'Unauthorized access' 
        });
    }
    
    const quizId = req.params.id;
    const studentId = req.query.studentId;
    
    if (!studentId) {
        return res.status(400).json({ 
            success: false, 
            message: 'Student ID is required' 
        });
    }
    
    try {
        const connection = await pool.getConnection();
        
        try {
            // Verify the quiz belongs to this coordinator
            const [quizCheck] = await connection.execute(
                'SELECT * FROM quizzes WHERE id = ? AND created_by = ?',
                [quizId, req.session.user.id]
            );
            
            if (quizCheck.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Quiz not found or you do not have permission to view it' 
                });
            }
              // Get violation frames for this student
            const [frames] = await connection.execute(
                `SELECT id, quiz_id, student_username, violation_type, 
                 timestamp, frame_data, incident_count
                 FROM quiz_violation_frames
                 WHERE quiz_id = ? AND student_username = ?
                 ORDER BY timestamp ASC`,
                [quizId, studentId]
            );
            
            return res.json({ 
                success: true, 
                frames: frames
            });
            
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error fetching violation frames:', err);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to load violation frames' 
        });
    }
});

// Admin Route //

// ======= ADMIN FUNCTIONALITY =======

// Secret entry point for admin access

function isAdminAuthenticated(req, res, next) {
    if (!req.session.admin) {
        return res.status(401).json({ message: 'Unauthorized access' });
    }
    next();
}

app.post('/api/create-admin/:token', async (req, res) => {
    // First validate that the token matches your admin token
    const { token } = req.params;
    
    if (token !== process.env.ADMIN_TOKEN) {
        return res.status(403).json({ success: false, message: 'Invalid admin token' });
    }
    
    try {
        const { username, password, accessLevel = 'standard', secretKey } = req.body;
        
        // Additional security - require a secret key from .env
        if (secretKey !== process.env.ADMIN_CREATION_KEY) {
            return res.status(403).json({ success: false, message: 'Invalid secret key' });
        }
        
        // Rest of your code remains the same...
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password required' });
        }
        
        const connection = await pool.getConnection();
        
        try {
            // Check if admin table exists, create if not
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS admins (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    access_level VARCHAR(20) DEFAULT 'standard',
                    last_login DATETIME,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Check if admin logs table exists, create if not
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS admin_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    admin_username VARCHAR(255) NOT NULL,
                    action VARCHAR(50) NOT NULL,
                    table_name VARCHAR(50) NOT NULL,
                    record_id VARCHAR(255) NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX (admin_username),
                    INDEX (action)
                )
            `);
            
            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Insert the admin user
            await connection.execute(
                'INSERT INTO admins (username, password, access_level) VALUES (?, ?, ?)',
                [username, hashedPassword, accessLevel]
            );
            
            return res.json({ 
                success: true, 
                message: 'Admin user created successfully',
                adminUrl: `/admin-access/${process.env.ADMIN_TOKEN}`
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Admin creation error:', error);
        return res.status(500).json({ 
            success: false, 
            message: `Failed to create admin: ${error.message}`
        });
    }
});

// Admin access route (for login page)
app.get(`/admin-access/${process.env.ADMIN_TOKEN}`, (req, res) => {
    res.render('admin-login', { token: process.env.ADMIN_TOKEN });
});


// Admin login handler
app.post(`/admin-login/${process.env.ADMIN_TOKEN}`, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).render('admin-dashboard', { 
                token: process.env.ADMIN_TOKEN,
                error: 'Username and password are required'
            });
        }
        
        const connection = await pool.getConnection();
        
        try {
            const [admins] = await connection.execute(
                'SELECT * FROM admins WHERE username = ?',
                [username]
            );
            
            if (admins.length === 0 || !(await bcrypt.compare(password, admins[0].password))) {
                return res.status(401).render('admin-dashboard', { 
                    token: process.env.ADMIN_TOKEN,
                    error: 'Invalid credentials'
                });
            }
            
            // Update last login time
            await connection.execute(
                'UPDATE admins SET last_login = NOW() WHERE username = ?',
                [username]
            );
            
            // Set admin in session
            req.session.admin = {
                username: admins[0].username,
                access_level: admins[0].access_level
            };
            
            return res.redirect(`/admin-dashboard/${process.env.ADMIN_TOKEN}`);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Admin login error:', error);
        return res.status(500).render('admin-dashboard', { 
            token: process.env.ADMIN_TOKEN,
            error: 'An error occurred. Please try again.'
        });
    }
});

// Admin dashboard

/**
 * Admin Dashboard Route
 * 
 * This route renders the administrator dashboard with system statistics
 * and recent activity data. It provides an overview of the platform usage
 * and access to various administrative functions.
 * 
 * The route is protected by a token and admin session authentication.
 */
app.get(`/admin-dashboard/${process.env.ADMIN_TOKEN}`, async (req, res) => {
    // Check if admin is logged in
    if (!req.session.admin) {
        return res.redirect(`/admin-access/${process.env.ADMIN_TOKEN}`);
    }

    try {
        const connection = await pool.getConnection();
        
        try {
            // Collect system statistics from the database
            const [studentCount] = await connection.execute('SELECT COUNT(*) as count FROM students');
            const [coordinatorCount] = await connection.execute('SELECT COUNT(*) as count FROM coordinators');
            const [quizCount] = await connection.execute('SELECT COUNT(*) as count FROM quizzes');
            const [attemptCount] = await connection.execute('SELECT COUNT(*) as count FROM quiz_attempts');
            const [securityLogs] = await connection.execute('SELECT COUNT(*) as count FROM quiz_security_logs');
              // Retrieve recent user registrations (both students and coordinators)
            const [recentUsers] = await connection.execute(`
                (SELECT 'student' AS role, username, first_name, last_name, email 
                FROM students ORDER BY username DESC LIMIT 5)
                UNION ALL
                (SELECT 'coordinator' AS role, username, first_name, last_name, email 
                FROM coordinators ORDER BY username DESC LIMIT 5)
                LIMIT 10
            `);
            
            // Retrieve recently created quizzes for the admin dashboard
            const [recentQuizzes] = await connection.execute(`
                SELECT id, title, created_by, created_date, is_active 
                FROM quizzes 
                ORDER BY created_date DESC 
                LIMIT 10
            `);
            
            // Return admin dashboard with all the data
            return res.render('admin-dashboard', {
                admin: req.session.admin,
                token: process.env.ADMIN_TOKEN,
                stats: {
                    students: studentCount[0].count,
                    coordinators: coordinatorCount[0].count,
                    quizzes: quizCount[0].count,
                    attempts: attemptCount[0].count,
                    securityLogs: securityLogs[0].count
                },
                recentUsers,
                recentQuizzes
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Admin dashboard error:', error);
        return res.status(500).render('error', { 
            message: 'Failed to load admin dashboard'
        });
    }
});
    /**
   * API endpoint for admin data retrieval with pagination
   * 
   * This endpoint allows administrators to retrieve data from any table
   * in the database with pagination support. It includes security measures
   * to prevent SQL injection by validating table names.
   */
  app.get('/api/admin/data/:table', isAdminAuthenticated, async (req, res) => {
      try {
          const { table } = req.params;
          const { page = 1, limit = 10 } = req.query;
          const offset = (page - 1) * limit;
          
          // Validate table name against whitelist to prevent SQL injection
          const allowedTables = [
              'students', 'coordinators', 'quizzes', 'questions', 
              'options', 'quiz_attempts', 'quiz_answers', 'quiz_security_logs'
          ];
          
          if (!allowedTables.includes(table)) {
              return res.status(400).json({ message: 'Invalid table name' });
          }
          
          const connection = await pool.getConnection();
          
          try {
              // Get total count
              const [countResult] = await connection.execute(`SELECT COUNT(*) as total FROM ${table}`);
              const total = countResult[0].total;
              
              // Get paginated data
              const [data] = await connection.execute(
                  `SELECT * FROM ${table} LIMIT ? OFFSET ?`, 
                  [parseInt(limit), parseInt(offset)]
              );
              
              return res.json({
                  data,
                  pagination: {
                      total,
                      page: parseInt(page),
                      limit: parseInt(limit),
                      pages: Math.ceil(total / limit)
                  }
              });
          } finally {
              connection.release();
          }
      } catch (error) {
          console.error('Admin data fetch error:', error);
          return res.status(500).json({ message: 'Failed to fetch data' });
      }
  });

// API endpoint to delete a record
app.delete('/api/admin/delete/:table/:idField/:id',isAdminAuthenticated, async (req, res) => {
    try {
        const { table, idField, id } = req.params;
        
        // Validate table name and ID field for security
        const allowedTables = {
            'students': 'username',
            'coordinators': 'username',
            'quizzes': 'id',
            'questions': 'id',
            'options': 'id',
            'quiz_attempts': 'id',
            'quiz_answers': 'id',
            'quiz_security_logs': 'id'
        };
        
        if (!allowedTables[table] || allowedTables[table] !== idField) {
            return res.status(400).json({ success: false, message: 'Invalid table or ID field' });
        }
        
        const connection = await pool.getConnection();
        
        try {
            // Start transaction for safety
            await connection.beginTransaction();
            
            // Log this deletion operation
            await connection.execute(
                'INSERT INTO admin_logs (admin_username, action, table_name, record_id) VALUES (?, ?, ?, ?)',
                [req.session.admin.username, 'DELETE', table, id]
            );
            
            // Execute the delete
            const [result] = await connection.execute(
                `DELETE FROM ${table} WHERE ${idField} = ?`,
                [id]
            );
            
            await connection.commit();
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'Record not found' });
            }
            
            return res.json({ 
                success: true, 
                message: `Record deleted successfully from ${table}` 
            });
        } catch (error) {
            await connection.rollback();
            console.error('Delete operation error:', error);
            return res.status(500).json({ 
                success: false, 
                message: `Failed to delete: ${error.message}`
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Admin delete error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Admin logout endpoint
app.get(`/admin-logout/${process.env.ADMIN_TOKEN}`, (req, res) => {
    // Only destroy the admin part of the session
    delete req.session.admin;
    res.redirect(`/admin-access/${process.env.ADMIN_TOKEN}`);
});

// Create an admin user via API (should be disabled in production after initial setup)
app.post(`/api/create-admin/${process.env.ADMIN_TOKEN}`, async (req, res) => {
    try {
        const { username, password, accessLevel = 'standard', secretKey } = req.body;
        
        // Additional security - require a secret key from .env
        if (secretKey !== process.env.ADMIN_CREATION_KEY) {
            return res.status(403).json({ success: false, message: 'Invalid secret key' });
        }
        
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password required' });
        }
        
        const connection = await pool.getConnection();
        
        try {
            // Check if admin table exists, create if not
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS admins (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    access_level VARCHAR(20) DEFAULT 'standard',
                    last_login DATETIME,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Check if admin logs table exists, create if not
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS admin_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    admin_username VARCHAR(255) NOT NULL,
                    action VARCHAR(50) NOT NULL,
                    table_name VARCHAR(50) NOT NULL,
                    record_id VARCHAR(255) NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX (admin_username),
                    INDEX (action)
                )
            `);
            
            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Insert the admin user
            await connection.execute(
                'INSERT INTO admins (username, password, access_level) VALUES (?, ?, ?)',
                [username, hashedPassword, accessLevel]
            );
            
            return res.json({ 
                success: true, 
                message: 'Admin user created successfully',
                adminUrl: `/admin-access/${process.env.ADMIN_TOKEN}`
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Admin creation error:', error);
        return res.status(500).json({ 
            success: false, 
            message: `Failed to create admin: ${error.message}`
        });
    }
});



// Admin Route End //

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
    process.exit(1);
});

// Cleanup function for graceful shutdown
/**
 * Cleanup function for graceful server shutdown
 * 
 * This function ensures proper cleanup of resources when the server shuts down:
 * - Closes the HTTP server to stop accepting new connections
 * - Closes all database connections properly
 * - Clears all active sessions
 * 
 * The cleanup process is executed when the server receives termination signals.
 */
function cleanup() {
    console.log('Starting cleanup process...');
    
    // Create a promise to handle server shutdown
    const serverClose = new Promise((resolve) => {
        server.close(() => {
            console.log('HTTP server closed successfully');
            resolve();
        });
    });

    // Create a promise to handle database connection pool end
    const poolClose = new Promise((resolve, reject) => {
        pool.end((err) => {
            if (err) {
                console.error('Error closing database connection pool:', err);
                reject(err);
            } else {
                console.log('Database connection pool closed successfully');
                resolve();
            }
        });
    });

    // Handle cleanup of all active sessions
    const sessionCleanup = new Promise((resolve) => {
        if (app.locals.sessions) {
            Object.keys(app.locals.sessions).forEach(sessionId => {
                delete app.locals.sessions[sessionId];
            });
        }
        console.log('Sessions cleared');
        resolve();
    });

    // Execute all cleanup tasks
    Promise.all([serverClose, poolClose, sessionCleanup])
        .then(() => {
            console.log('Cleanup completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Error during cleanup:', err);
            process.exit(1);
        });
}

/**
 * Register cleanup handlers for graceful shutdown
 * 
 * The application listens for termination signals (SIGTERM, SIGINT)
 * and performs cleanup operations before shutting down.
 */
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

/**
 * Start the Express server
 * 
 * Initialize the server on the specified port (from environment variables or default 3000).
 * This is the final step that makes the application available to users.
 */
const PORT = process.env.PORT || 3000; // Use PORT from environment variables or default to 3000
const server = app.listen(PORT, () => {
    console.log(`Pragati Online Exam Platform server running on port ${PORT}`);
    console.log(`Server started at: ${new Date().toISOString()}`);
});
