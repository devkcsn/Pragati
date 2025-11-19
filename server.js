// Import required modules
const express = require('express'); // For creating the server
const session = require('express-session'); // For session management
const bodyParser = require('body-parser'); // For parsing request bodies
const bcrypt = require('bcrypt'); // For password hashing
const app = express(); // Create an Express application
const fsPromises = require('fs').promises; // For file system operations
const cron = require('node-cron'); // For scheduling tasks
const cors = require('cors'); // For CORS support
const path = require('path'); // For path resolution
const fs = require('fs'); // For file system operations
require('dotenv').config(); // Load environment variables

// Middleware setup 
app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

// Authentication middleware to protect routes
// This middleware checks if the user is authenticated before allowing access to certain routes
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/');
};

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_key_change_this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// MySQL Connection Pool 
const mysql = require('mysql2/promise');
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
});

// Registration route -- This route handles the registration of both students and coordinators
app.post('/register', async (req, res) => {
    try {
        console.log("Form submission:", req.body);
        const { role, first_name, last_name, email, phone, username, password } = req.body;

        // Check which fields are missing
        const missingFields = [];
        if (!role) missingFields.push('role');
        if (!first_name) missingFields.push('first_name');
        if (!last_name) missingFields.push('last_name');
        if (!email) missingFields.push('email');
        if (!phone) missingFields.push('phone');
        if (!username) missingFields.push('username');
        if (!password) missingFields.push('password');
        
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

// Face detection //

// Face detection logic start // 
const faceMonitorRouter = express.Router();
const faceMonitor = require('./face_monitor_service');

// Start face monitoring for a quiz session
faceMonitorRouter.post('/api/quiz/:id/start-monitoring', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'student') {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const quizId = req.params.id;
    const sessionId = `${req.session.user.id}_${quizId}`;
    
    try {
        // Start the face monitoring process
        const monitoringInfo = await faceMonitor.startMonitoring(sessionId);
        
        // Record monitoring session in database (optional)
        await recordMonitoringSession(quizId, req.session.user.id, monitoringInfo.websocketPort);
        
        return res.status(200).json({
            success: true,
            websocketPort: monitoringInfo.websocketPort,
            status: monitoringInfo.status
        });
    } catch (err) {
        console.error('Error starting face monitoring:', err);
        return res.status(500).json({ message: 'Failed to start monitoring: ' + err.message });
    }
});

// Stop face monitoring for a quiz session
faceMonitorRouter.post('/api/quiz/:id/stop-monitoring', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'student') {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const quizId = req.params.id;
    const sessionId = `${req.session.user.id}_${quizId}`;
    
    try {
        const stopped = faceMonitor.stopMonitoring(sessionId);
        
        return res.status(200).json({
            success: true,
            stopped: stopped
        });
    } catch (err) {
        console.error('Error stopping face monitoring:', err);
        return res.status(500).json({ message: 'Failed to stop monitoring: ' + err.message });
    }
});

// Add security issue endpoint to record face monitoring violations
faceMonitorRouter.post('/api/quiz/face-monitoring-issue', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'student') {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { quizId, issueType, awayDuration } = req.body;
    
    try {
        const connection = await pool.getConnection();
        try {
            // Format the date in MySQL-compatible format
            const now = new Date();
            const formattedDate = now.toISOString().slice(0, 19).replace('T', ' ');
            
            await connection.execute(
                'INSERT INTO security_issues (quiz_id, student_username, issue_type, details, timestamp) VALUES (?, ?, ?, ?, ?)',
                [quizId, req.session.user.id, issueType, `Looking away for ${awayDuration} seconds`, formattedDate]
            );
            
            return res.status(200).json({ success: true });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error recording face monitoring issue:', err);
        return res.status(500).json({ message: 'Failed to record issue: ' + err.message });
    }
});

// Register the router with the app
app.use(faceMonitorRouter);

// Helper function to record monitoring session in database
async function recordMonitoringSession(quizId, studentId, port) {
    // This is optional but would be useful for tracking and auditing
    // Implement according to your database schema
    try {
        // Example implementation with your existing pool connection
        const connection = await pool.getConnection();
        try {
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

// API endpoint to get quiz duration for students during takeQuiz
app.get('/api/quizzes/:quizId/duration', isAuthenticated, async (req, res) => {
    try {
        const quizId = req.params.quizId;
        
        // Get connection from pool
        const connection = await pool.getConnection();
        
        try {
            // Query to get quiz duration
            const [rows] = await connection.execute(
                'SELECT duration FROM quizzes WHERE id = ?',
                [quizId]
            );
            
            if (rows.length === 0) {
                return res.status(404).json({ message: 'Quiz not found' });
            }
            
            // Return the duration
            return res.json({ duration: rows[0].duration });
            
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error fetching quiz duration:', err);
        return res.status(500).json({ 
            message: 'An error occurred while fetching quiz duration' 
        });
    }
});

//Quiz submission endpoint handles unanswered questions for students
app.post('/api/quiz/:id/submit', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'student') {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const quizId = req.params.id;
    const { answers, autoSubmitted, allQuestionIds } = req.body;
    
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

// API endpoint to create a quiz for coordinators
app.post('/api/quizzes', isAuthenticated, async (req, res) => {
    try {
        // Check if user is a coordinator
        if (req.session.user.role !== 'coordinator') {
            return res.status(403).json({ message: 'Only coordinators can create quizzes' });
        }

        const { title, description, questions, scheduledDate, deadlineDate, duration } = req.body;

        // Validate required fields
        if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ message: 'Title and at least one question are required' });
        }

        // Validate scheduled date if provided
        let parsedScheduledDate = null;
        if (scheduledDate) {
            parsedScheduledDate = new Date(scheduledDate);
            if (isNaN(parsedScheduledDate.getTime())) {
                return res.status(400).json({ message: 'Invalid scheduled date format' });
            }
        }
        
        // Validate deadline date if provided
        let parsedDeadlineDate = null;
        if (deadlineDate) {
            parsedDeadlineDate = new Date(deadlineDate);
            if (isNaN(parsedDeadlineDate.getTime())) {
                return res.status(400).json({ message: 'Invalid deadline date format' });
            }
        }
        
        // Validate that deadline is after scheduled date if both are provided
        if (parsedScheduledDate && parsedDeadlineDate && parsedDeadlineDate <= parsedScheduledDate) {
            return res.status(400).json({ message: 'Deadline must be after the scheduled date' });
        }

        const connection = await pool.getConnection();
        
        try {
            // Begin transaction
            await connection.beginTransaction();
            
            // Insert quiz record with scheduled date, deadline date, and duration
            const [quizResult] = await connection.execute(
                'INSERT INTO quizzes (title, description, created_by, scheduled_date, deadline_date, duration, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    title, 
                    description || '', 
                    req.session.user.id, 
                    parsedScheduledDate, 
                    parsedDeadlineDate,
                    duration || 30, // Default to 30 minutes if not specified
                    parsedScheduledDate ? false : true
                ]
            );
            
            const quizId = quizResult.insertId;
            
            // Insert questions
            for (const question of questions) {
                if (!question.text || !question.options || !Array.isArray(question.options)) {
                    throw new Error('Invalid question format');
                }
                
                const [questionResult] = await connection.execute(
                    'INSERT INTO questions (quiz_id, question_text) VALUES (?, ?)',
                    [quizId, question.text]
                );
                
                const questionId = questionResult.insertId;
                
                // Insert options
                for (const option of question.options) {
                    if (!option.text) continue;
                    
                    await connection.execute(
                        'INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)',
                        [questionId, option.text, option.isCorrect ? 1 : 0]
                    );
                }
            }
            
            // Commit transaction
            await connection.commit();
            
            return res.status(201).json({ 
                success: true,
                message: 'Quiz created successfully',
                quizId: quizId
            });
            
        } catch (err) {
            // Rollback on error
            await connection.rollback();
            console.error('Database error:', err);
            return res.status(500).json({ 
                message: 'Error creating quiz: ' + err.message 
            });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ 
            message: 'An unexpected error occurred: ' + err.message 
        });
    }
});

// Log security issues during quiz
app.post('/api/quiz/security-issue', async (req, res) => {
    const { quizId, issueType, timestamp } = req.body;
    
    try {
        // Validate that required parameters are present
        if (!quizId || !issueType || !timestamp) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required parameters: quizId, issueType, and timestamp are all required' 
            });
        }
        
        // Convert ISO string to MySQL datetime format
        const dateObj = new Date(timestamp);
        const mysqlTimestamp = dateObj.toISOString().slice(0, 19).replace('T', ' ');
        
        // Use pool instead of connection and ensure all parameters are defined
        await pool.execute(
            'INSERT INTO quiz_security_logs (quiz_id, student_username, issue_type, timestamp) VALUES (?, ?, ?, ?)',
            [quizId, req.session.user.id, issueType, mysqlTimestamp]
        );
        
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

// Student dashboard routes
app.get('/studentDashboard', isAuthenticated, (req, res) => {
    if (req.session.user.role !== 'student') {
        return res.redirect('/');
    }
    res.render('studentDashboard', { user: req.session.user });
});

//Coordinator dashboard routes
app.get('/coordinatorDashboard', isAuthenticated, (req, res) => {
    if (req.session.user.role !== 'coordinator') {
        return res.redirect('/');
    }
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
// This runs every minute to check for quizzes that need to be activated
cron.schedule('* * * * *', async () => {
    console.log('Running quiz activation check...');
    try {
        const connection = await pool.getConnection();
        try {
            // Find quizzes where scheduled date has passed but they're not active yet
            const [quizzes] = await connection.execute(
                'UPDATE quizzes SET is_active = TRUE WHERE scheduled_date <= NOW() AND is_active = FALSE'
            );
            
            if (quizzes.affectedRows > 0) {
                console.log(`Activated ${quizzes.affectedRows} quizzes`);
            }
        } catch (err) {
            console.error('Error in quiz activation job:', err);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Failed to get database connection for quiz activation:', err);
    }
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/');
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

// Route to take a specific quiz
app.get('/takeQuiz/:id', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'student') {
        return res.redirect('/');
    }
    
    const quizId = req.params.id;
    
    try {
        const connection = await pool.getConnection();
        try {
            // Check if quiz exists and is active
            const [quizzes] = await connection.execute(
                'SELECT * FROM quizzes WHERE id = ? AND is_active = TRUE',
                [quizId]
            );
            
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
            
            // Get all options for these questions
            for (let question of questions) {
                const [options] = await connection.execute(
                    'SELECT id, option_text FROM options WHERE question_id = ?',
                    [question.id]
                );
                question.options = options;
            }
            
            // Render the quiz page
            res.render('takeQuiz', {
                user: req.session.user,
                quiz: quiz,
                questions: questions,
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

app.get(`/admin-dashboard/${process.env.ADMIN_TOKEN}`, async (req, res) => {
    // Check if admin is logged in
    if (!req.session.admin) {
        return res.redirect(`/admin-access/${process.env.ADMIN_TOKEN}`);
    }

    try {
        const connection = await pool.getConnection();
        
        try {
            // Get system statistics
            const [studentCount] = await connection.execute('SELECT COUNT(*) as count FROM students');
            const [coordinatorCount] = await connection.execute('SELECT COUNT(*) as count FROM coordinators');
            const [quizCount] = await connection.execute('SELECT COUNT(*) as count FROM quizzes');
            const [attemptCount] = await connection.execute('SELECT COUNT(*) as count FROM quiz_attempts');
            const [securityLogs] = await connection.execute('SELECT COUNT(*) as count FROM quiz_security_logs');
            
            // Get latest data
            const [recentUsers] = await connection.execute(`
                (SELECT 'student' AS role, username, first_name, last_name, email 
                FROM students ORDER BY username DESC LIMIT 5)
                UNION ALL
                (SELECT 'coordinator' AS role, username, first_name, last_name, email 
                FROM coordinators ORDER BY username DESC LIMIT 5)
                LIMIT 10
            `);
            
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
  
  // API endpoint to get paginated data for each table
  app.get('/api/admin/data/:table', isAdminAuthenticated, async (req, res) => {
      try {
          const { table } = req.params;
          const { page = 1, limit = 10 } = req.query;
          const offset = (page - 1) * limit;
          
          // Validate table name to prevent SQL injection
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
function cleanup() {
    console.log('Starting cleanup...');
    
    // Create a promise to handle server shutdown
    const serverClose = new Promise((resolve) => {
        server.close(() => {
            console.log('Server closed');
            resolve();
        });
    });

    // Create a promise to handle database connection pool end
    const poolClose = new Promise((resolve, reject) => {
        pool.end((err) => {
            if (err) {
                console.error('Error closing database pool:', err);
                reject(err);
            } else {
                console.log('Database pool closed');
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

// Register cleanup handlers
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Start the server (replace the existing app.listen call)
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
