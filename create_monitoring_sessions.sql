CREATE TABLE IF NOT EXISTS monitoring_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    student_username VARCHAR(255) NOT NULL,
    websocket_port INT NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    status VARCHAR(20) DEFAULT 'active',
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY (student_username) REFERENCES students(username) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX (quiz_id, student_username)
);
