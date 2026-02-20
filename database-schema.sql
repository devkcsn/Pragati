-- ============================================
-- Database Schema for Quiz Monitoring System
-- ============================================

-- Create Database (if needed)
CREATE DATABASE IF NOT EXISTS quiz_system;
USE quiz_system;

-- ============================================
-- Table: students
-- ============================================
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Table: coordinators
-- ============================================
CREATE TABLE IF NOT EXISTS coordinators (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Table: quizzes
-- ============================================
CREATE TABLE IF NOT EXISTS quizzes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    coordinator_username VARCHAR(50) NOT NULL,
    duration INT DEFAULT 30 COMMENT 'Duration in minutes',
    total_marks INT DEFAULT 100,
    passing_marks INT DEFAULT 40,
    start_time DATETIME,
    end_time DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('draft', 'active', 'completed', 'archived') DEFAULT 'draft',
    FOREIGN KEY (coordinator_username) REFERENCES coordinators(username) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_coordinator (coordinator_username),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Table: questions
-- ============================================
CREATE TABLE IF NOT EXISTS questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    question_text TEXT NOT NULL,
    option_a VARCHAR(500),
    option_b VARCHAR(500),
    option_c VARCHAR(500),
    option_d VARCHAR(500),
    correct_answer CHAR(1) CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
    marks INT DEFAULT 1,
    question_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    INDEX idx_quiz (quiz_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Table: quiz_attempts
-- ============================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    student_username VARCHAR(50) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP NULL,
    score INT DEFAULT 0,
    total_marks INT,
    status ENUM('in_progress', 'submitted', 'evaluated') DEFAULT 'in_progress',
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY (student_username) REFERENCES students(username) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_quiz_student (quiz_id, student_username),
    INDEX idx_student (student_username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Table: student_answers
-- ============================================
CREATE TABLE IF NOT EXISTS student_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT NOT NULL,
    question_id INT NOT NULL,
    selected_answer CHAR(1) CHECK (selected_answer IN ('A', 'B', 'C', 'D')),
    is_correct BOOLEAN DEFAULT FALSE,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_attempt_question (attempt_id, question_id),
    INDEX idx_attempt (attempt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Table: monitoring_sessions
-- ============================================
CREATE TABLE IF NOT EXISTS monitoring_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    student_username VARCHAR(50) NOT NULL,
    websocket_port INT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    status VARCHAR(20) DEFAULT 'active',
    violation_count INT DEFAULT 0,
    screenshots_captured INT DEFAULT 0,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY (student_username) REFERENCES students(username) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_quiz_student (quiz_id, student_username),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Table: face_detection_logs
-- ============================================
CREATE TABLE IF NOT EXISTS face_detection_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    detection_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    faces_detected INT DEFAULT 0,
    confidence_score DECIMAL(5,2),
    violation_type VARCHAR(50) COMMENT 'no_face, multiple_faces, low_confidence',
    screenshot_path VARCHAR(500),
    FOREIGN KEY (session_id) REFERENCES monitoring_sessions(id) ON DELETE CASCADE,
    INDEX idx_session (session_id),
    INDEX idx_violation (violation_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Table: admin_users (optional)
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Insert Sample Admin User
-- ============================================
-- Password: admin123 (hashed with bcrypt)
-- Use this for initial login, then change it!
INSERT INTO admin_users (username, password, email, full_name) 
VALUES ('admin', '$2b$10$rKJqK4L3yH.YxL8m9vJ9/.7oZHZ8qZ3YQZ9qZ3YQZ9qZ3YQZ9qZ3Y', 'admin@quiz-system.com', 'System Administrator')
ON DUPLICATE KEY UPDATE username=username;

-- ============================================
-- Create Views for Reporting
-- ============================================

-- View: Quiz Performance Summary
CREATE OR REPLACE VIEW quiz_performance AS
SELECT 
    q.id AS quiz_id,
    q.title AS quiz_title,
    q.coordinator_username,
    COUNT(DISTINCT qa.student_username) AS total_attempts,
    AVG(qa.score) AS average_score,
    MAX(qa.score) AS highest_score,
    MIN(qa.score) AS lowest_score,
    COUNT(CASE WHEN qa.score >= q.passing_marks THEN 1 END) AS passed_count,
    COUNT(CASE WHEN qa.score < q.passing_marks THEN 1 END) AS failed_count
FROM quizzes q
LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.status = 'evaluated'
GROUP BY q.id, q.title, q.coordinator_username;

-- View: Student Performance
CREATE OR REPLACE VIEW student_performance AS
SELECT 
    s.username,
    CONCAT(s.first_name, ' ', s.last_name) AS full_name,
    COUNT(qa.id) AS quizzes_attempted,
    AVG(qa.score) AS average_score,
    SUM(CASE WHEN qa.status = 'submitted' THEN 1 ELSE 0 END) AS completed_quizzes
FROM students s
LEFT JOIN quiz_attempts qa ON s.username = qa.student_username
GROUP BY s.username, s.first_name, s.last_name;

-- View: Monitoring Violations
CREATE OR REPLACE VIEW monitoring_violations AS
SELECT 
    ms.id AS session_id,
    ms.quiz_id,
    ms.student_username,
    ms.started_at,
    ms.ended_at,
    ms.violation_count,
    COUNT(fdl.id) AS total_detections,
    SUM(CASE WHEN fdl.violation_type = 'no_face' THEN 1 ELSE 0 END) AS no_face_count,
    SUM(CASE WHEN fdl.violation_type = 'multiple_faces' THEN 1 ELSE 0 END) AS multiple_faces_count
FROM monitoring_sessions ms
LEFT JOIN face_detection_logs fdl ON ms.id = fdl.session_id
GROUP BY ms.id, ms.quiz_id, ms.student_username, ms.started_at, ms.ended_at, ms.violation_count;

-- ============================================
-- Grant Permissions (adjust as needed)
-- ============================================
-- GRANT ALL PRIVILEGES ON quiz_system.* TO 'your_user'@'%';
-- FLUSH PRIVILEGES;

-- ============================================
-- End of Schema
-- ============================================
