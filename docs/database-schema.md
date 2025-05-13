# Database Schema Documentation for Pragati

This document provides detailed information about the database schema used in the Pragati Online Exam Platform.

## 1. Overview

The Pragati platform uses a MySQL database to store all application data, including user information, quiz content, student responses, and security monitoring data.

## 2. Entity Relationship Diagram

```
+---------------+       +-------------+       +-------------+
| coordinators  |<------| quizzes     |------>| students    |
+---------------+       +-------------+       +-------------+
                              |
                              |
                        +-----v------+
                        | questions  |
                        +------------+
                              |
                              |
                        +-----v------+
                        | options    |
                        +------------+
                              ^
                              |
                        +-----+------+       +------------------+
                        | quiz_answers|<------| quiz_attempts   |
                        +------------+       +------------------+
                                                     |
                                             +-------v----------+
                                             | quiz_security_logs|
                                             +------------------+
                                                     |
                                             +-------v----------+
                                             |monitoring_sessions|
                                             +------------------+
                                                     |
                                             +-------v----------+
                                             |quiz_violation_frames|
                                             +------------------+
```

## 3. Table Definitions

### students
Stores student user account information.

| Column     | Type         | Description                |
|------------|--------------|----------------------------|
| id         | INT          | Auto-increment primary key |
| username   | VARCHAR(100) | Unique student username    |
| password   | VARCHAR(255) | Hashed password            |
| first_name | VARCHAR(100) | Student's first name       |
| last_name  | VARCHAR(100) | Student's last name        |
| email      | VARCHAR(100) | Unique email address       |
| phone      | VARCHAR(20)  | Contact phone number       |
| created_at | TIMESTAMP    | Account creation time      |

### coordinators
Stores coordinator user account information.

| Column     | Type         | Description                |
|------------|--------------|----------------------------|
| id         | INT          | Auto-increment primary key |
| username   | VARCHAR(100) | Unique coordinator username |
| password   | VARCHAR(255) | Hashed password            |
| first_name | VARCHAR(100) | Coordinator's first name   |
| last_name  | VARCHAR(100) | Coordinator's last name    |
| email      | VARCHAR(100) | Unique email address       |
| phone      | VARCHAR(20)  | Contact phone number       |
| created_at | TIMESTAMP    | Account creation time      |

### quizzes
Stores quiz definition and configuration.

| Column         | Type          | Description                      |
|----------------|---------------|----------------------------------|
| id             | INT           | Auto-increment primary key       |
| title          | VARCHAR(255)  | Quiz title                       |
| description    | TEXT          | Quiz description                 |
| created_by     | VARCHAR(100)  | Coordinator username (Foreign key) |
| is_active      | BOOLEAN       | Whether quiz is active           |
| scheduled_date | DATETIME      | When quiz becomes available      |
| deadline_date  | DATETIME      | When quiz expires                |
| duration       | INT           | Time limit in minutes            |
| created_at     | TIMESTAMP     | Quiz creation time               |
| updated_at     | TIMESTAMP     | Quiz last modification time      |

### questions
Stores individual questions for quizzes.

| Column       | Type         | Description                |
|--------------|--------------|----------------------------|
| id           | INT          | Auto-increment primary key |
| quiz_id      | INT          | Foreign key to quizzes     |
| question_text| TEXT         | The question content       |
| question_type| VARCHAR(50)  | Type of question           |
| image_url    | VARCHAR(255) | Optional image for question|
| position     | INT          | Order in quiz              |
| points       | INT          | Point value for question   |

### options
Stores answer options for questions.

| Column      | Type         | Description                 |
|-------------|--------------|-----------------------------|
| id          | INT          | Auto-increment primary key  |
| question_id | INT          | Foreign key to questions    |
| option_text | TEXT         | The option content          |
| is_correct  | BOOLEAN      | Whether option is correct   |
| position    | INT          | Order of options            |

### quiz_attempts
Records student quiz submissions.

| Column          | Type         | Description                  |
|-----------------|--------------|------------------------------|
| id              | INT          | Auto-increment primary key   |
| quiz_id         | INT          | Foreign key to quizzes       |
| student_username| VARCHAR(100) | Foreign key to students      |
| score           | INT          | Points achieved              |
| total_questions | INT          | Total questions in the quiz  |
| completed_date  | DATETIME     | When quiz was submitted      |
| auto_submitted  | BOOLEAN      | Whether auto-submitted due to violation |
| time_taken      | INT          | Seconds taken to complete    |
| created_at      | TIMESTAMP    | Record creation time         |

### quiz_answers
Records individual answers from quiz attempts.

| Column           | Type         | Description                  |
|------------------|--------------|------------------------------|
| id               | INT          | Auto-increment primary key   |
| attempt_id       | INT          | Foreign key to quiz_attempts |
| question_id      | INT          | Foreign key to questions     |
| selected_option_id| INT         | Foreign key to options       |
| is_correct       | BOOLEAN      | Whether answer was correct   |
| created_at       | TIMESTAMP    | Record creation time         |

### quiz_sessions
Tracks active quiz-taking sessions.

| Column           | Type         | Description                 |
|------------------|--------------|-----------------------------|
| id               | INT          | Auto-increment primary key  |
| quiz_id          | INT          | Foreign key to quizzes      |
| student_username | VARCHAR(100) | Foreign key to students     |
| started_at       | DATETIME     | When session began          |
| ended_at         | DATETIME     | When session ended (NULL if active) |
| status           | VARCHAR(50)  | Session status              |

### quiz_security_logs
Records security violations during quiz attempts.

| Column           | Type         | Description                 |
|------------------|--------------|-----------------------------|
| id               | INT          | Auto-increment primary key  |
| quiz_id          | INT          | Foreign key to quizzes      |
| student_username | VARCHAR(100) | Foreign key to students     |
| issue_type       | VARCHAR(100) | Type of security violation  |
| details          | TEXT         | Additional violation details|
| timestamp        | DATETIME     | When violation occurred     |
| created_at       | TIMESTAMP    | Record creation time        |

### monitoring_sessions
Records face monitoring session data.

| Column           | Type         | Description                 |
|------------------|--------------|-----------------------------|
| id               | INT          | Auto-increment primary key  |
| quiz_id          | INT          | Foreign key to quizzes      |
| student_username | VARCHAR(100) | Foreign key to students     |
| websocket_port   | INT          | Port used for WebSocket connection |
| started_at       | DATETIME     | When monitoring began       |
| ended_at         | DATETIME     | When monitoring ended (NULL if active) |
| created_at       | TIMESTAMP    | Record creation time        |

### quiz_violation_frames
Stores evidence frames from monitoring violations.

| Column           | Type         | Description                  |
|------------------|--------------|------------------------------|
| id               | INT          | Auto-increment primary key   |
| quiz_id          | INT          | Foreign key to quizzes       |
| student_username | VARCHAR(100) | Foreign key to students      |
| session_id       | VARCHAR(100) | Associated monitoring session|
| violation_type   | VARCHAR(50)  | Type of violation           |
| timestamp        | DATETIME     | When violation occurred      |
| frame_data       | LONGTEXT     | Base64 encoded image data    |
| incident_count   | INT          | Counter for similar incidents |
| created_at       | TIMESTAMP    | Record creation time         |

## 4. Key Relationships

### User Relationships

- **Coordinators to Quizzes**: One-to-many relationship. A coordinator can create many quizzes.
- **Students to Quiz Attempts**: One-to-many relationship. A student can attempt many quizzes.

### Quiz Content Relationships

- **Quizzes to Questions**: One-to-many relationship. A quiz contains many questions.
- **Questions to Options**: One-to-many relationship. A question has multiple answer options.

### Quiz Attempt Relationships

- **Quiz Attempts to Quiz Answers**: One-to-many relationship. A quiz attempt contains many individual answers.
- **Quiz Attempts to Security Logs**: One-to-many relationship. A quiz attempt may have multiple security violation logs.

### Monitoring Relationships

- **Monitoring Sessions to Violation Frames**: One-to-many relationship. A monitoring session may capture multiple violation frames.

## 5. Indexes and Performance Optimization

The following indexes are created to optimize query performance:

### Primary Keys
- All tables have an auto-increment integer primary key

### Foreign Key Indexes
- `quizzes`: Index on `created_by`
- `questions`: Index on `quiz_id`
- `options`: Index on `question_id`
- `quiz_attempts`: Indexes on `quiz_id` and `student_username`
- `quiz_answers`: Indexes on `attempt_id` and `question_id`
- `quiz_security_logs`: Indexes on `quiz_id` and `student_username`
- `monitoring_sessions`: Indexes on `quiz_id` and `student_username`
- `quiz_violation_frames`: Indexes on `quiz_id`, `student_username`, and `session_id`

### Additional Indexes
- `students`: Unique indexes on `username` and `email`
- `coordinators`: Unique indexes on `username` and `email`
- `quiz_sessions`: Index on `status` for quick lookup of active sessions
- `quiz_violation_frames`: Index on `timestamp` for temporal queries

## 6. Data Integrity Constraints

The following constraints ensure data integrity:

### NOT NULL Constraints
- Username, password, first_name, and last_name in user tables
- Title and created_by in quizzes table
- Question_text in questions table
- Quiz_id and student_username in quiz_attempts table

### UNIQUE Constraints
- Username and email in both students and coordinators tables

### Foreign Key Constraints
Foreign key constraints are implemented for all relationships between tables, with CASCADE or SET NULL delete actions as appropriate.

## 7. Data Type Considerations

- **VARCHAR vs TEXT**: TEXT used for variable-length content like question_text
- **DATETIME vs TIMESTAMP**: TIMESTAMP with DEFAULT CURRENT_TIMESTAMP for created_at fields
- **BOOLEAN**: Used for true/false flags (is_active, is_correct)
- **INT**: Used for IDs, counts, and numerical values

## 8. Initialization and Migration

The `Pragati.sql` file contains:
- Complete schema definition
- Initial constraint setup
- Base data required for application function

## 9. Database Maintenance

Recommended maintenance tasks:

- Regular backups (daily recommended)
- Periodic cleanup of old violation frames (configurable retention policy)
- Optimize tables with high write activity
- Monitor disk space, especially for the violation_frames table

## 10. Query Examples

### Get Student Quiz History

```sql
SELECT q.title, qa.score, qa.total_questions, qa.completed_date
FROM quiz_attempts qa
JOIN quizzes q ON qa.quiz_id = q.id
WHERE qa.student_username = ?
ORDER BY qa.completed_date DESC;
```

### Get Security Violations for a Quiz

```sql
SELECT sl.issue_type, sl.timestamp, sl.details, s.first_name, s.last_name
FROM quiz_security_logs sl
JOIN students s ON sl.student_username = s.username
WHERE sl.quiz_id = ?
ORDER BY sl.timestamp DESC;
```

### Get Violation Evidence

```sql
SELECT vf.violation_type, vf.timestamp, vf.frame_data
FROM quiz_violation_frames vf
WHERE vf.quiz_id = ? AND vf.student_username = ?
ORDER BY vf.timestamp DESC;
```

For additional assistance with database management, contact the database administrator.
