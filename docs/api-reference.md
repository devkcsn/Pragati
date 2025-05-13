# API Reference for Pragati

This document provides comprehensive information about the API endpoints available in the Pragati Online Exam Platform.

## 1. Authentication APIs

### Register a New User

Creates a new student or coordinator account.

**Endpoint:** `POST /register`

**Request Body:**
```json
{
  "role": "student|coordinator",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "1234567890",
  "username": "johndoe",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "redirectUrl": "/loginStudent" or "/loginCoordinator"
}
```

**Error Responses:**
- `400 Bad Request`: Missing fields or validation errors
- `500 Internal Server Error`: Server-side error

### Check Field Availability

Checks if a username, email, or phone is available for registration.

**Endpoint:** `GET /api/check-availability`

**Query Parameters:**
- `field`: Field to check (username, email, or phone)
- `value`: Value to check

**Response:**
```json
{
  "valid": true|false,
  "message": "username is available" or "This username is already in use"
}
```

### Student Login

Authenticates a student user.

**Endpoint:** `POST /loginStudent`

**Request Body:**
```json
{
  "username": "johndoe",
  "password": "securepassword"
}
```

**Response:**
- On success: Redirects to `/studentDashboard`
- On failure: Returns error message

### Coordinator Login

Authenticates a coordinator user.

**Endpoint:** `POST /loginCoordinator`

**Request Body:**
```json
{
  "username": "coordinator1",
  "password": "securepassword"
}
```

**Response:**
- On success: Redirects to `/coordinatorDashboard`
- On failure: Returns error message

## 2. Student APIs

### Get Available Quizzes

Retrieves a list of quizzes available to the student.

**Endpoint:** `GET /api/availableQuizzes`

**Authentication:** Required (Student)

**Response:**
```json
[
  {
    "id": 1,
    "title": "Python Basics",
    "description": "Test your knowledge of Python fundamentals",
    "scheduled_date": "2025-05-15T10:00:00.000Z",
    "deadline_date": "2025-05-20T10:00:00.000Z",
    "first_name": "John",
    "last_name": "Smith",
    "attempted": false
  }
]
```

### Get Student Statistics

Retrieves performance statistics for the current student.

**Endpoint:** `GET /api/student/stats`

**Authentication:** Required (Student)

**Response:**
```json
{
  "completedQuizzes": 5,
  "pendingQuizzes": 2,
  "averageScore": 78.5,
  "highestScore": 95.0
}
```

### Get Quiz Details

Retrieves details of a specific quiz for the student to take.

**Endpoint:** `GET /api/quiz/:id`

**Authentication:** Required (Student)

**Parameters:**
- `id`: Quiz ID

**Response:**
```json
{
  "id": 1,
  "title": "Python Basics",
  "description": "Test your knowledge of Python fundamentals",
  "duration": 30,
  "questions": [
    {
      "id": 101,
      "question_text": "What is the output of print(2 + 2)?",
      "options": [
        {
          "id": 1001,
          "option_text": "2"
        },
        {
          "id": 1002,
          "option_text": "4"
        },
        {
          "id": 1003,
          "option_text": "22"
        },
        {
          "id": 1004,
          "option_text": "Error"
        }
      ]
    }
  ]
}
```

### Get Quiz Duration

Retrieves the time limit for a specific quiz.

**Endpoint:** `GET /api/quizzes/:quizId/duration`

**Authentication:** Required (Student)

**Parameters:**
- `quizId`: Quiz ID

**Response:**
```json
{
  "duration": 30
}
```

### Submit Quiz

Submits a completed quiz with student answers.

**Endpoint:** `POST /api/quiz/:id/submit`

**Authentication:** Required (Student)

**Parameters:**
- `id`: Quiz ID

**Request Body:**
```json
{
  "answers": [
    {
      "questionId": 101,
      "optionId": 1002
    }
  ],
  "autoSubmitted": false
}
```

**Response:**
```json
{
  "success": true,
  "score": 1,
  "total": 1,
  "message": "Quiz submitted successfully"
}
```

## 3. Quiz Security APIs

### Start Monitoring Session

Starts webcam-based face monitoring for a quiz session.

**Endpoint:** `POST /api/quiz/:id/start-monitoring`

**Authentication:** Required (Student)

**Parameters:**
- `id`: Quiz ID

**Response:**
```json
{
  "success": true,
  "websocketPort": 8765
}
```

### Stop Monitoring Session

Stops a face monitoring session.

**Endpoint:** `POST /api/quiz/:id/stop-monitoring`

**Authentication:** Required (Student)

**Parameters:**
- `id`: Quiz ID

**Response:**
```json
{
  "success": true,
  "message": "Monitoring session stopped successfully"
}
```

### Log Security Issue

Records a browser-based security violation.

**Endpoint:** `POST /api/quiz/security-issue`

**Authentication:** Required (Student)

**Request Body:**
```json
{
  "quizId": 1,
  "issueType": "tab-switch|fullscreen-exit|dev-tools-opened",
  "timestamp": "2025-05-13T10:15:30.000Z"
}
```

**Response:**
```json
{
  "success": true
}
```

### Log Face Monitoring Issue

Records a webcam-based monitoring violation.

**Endpoint:** `POST /api/quiz/face-monitoring-issue`

**Authentication:** Required (Student)

**Request Body:**
```json
{
  "quizId": 1,
  "issueType": "looking-away|multiple-faces|no-face",
  "awayDuration": 5.2,
  "timestamp": "2025-05-13T10:15:30.000Z"
}
```

**Response:**
```json
{
  "success": true
}
```

### Store Violation Frame

Stores a webcam screenshot of a violation.

**Endpoint:** `POST /api/quiz/store-violation-frame`

**Authentication:** Required

**Request Body:**
```json
{
  "quiz_id": 1,
  "student_username": "johndoe",
  "violation_type": "looking-away",
  "frame_data": "base64-encoded-image-data",
  "timestamp": "2025-05-13T10:15:30.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Violation frame stored successfully",
  "frameId": 123
}
```

### Get Violation Frames

Retrieves violation frames for review.

**Endpoint:** `GET /api/quiz/get-violation-frames`

**Authentication:** Required (Coordinator)

**Query Parameters:**
- `quiz_id`: Required - Quiz ID
- `student_username`: Optional - Filter by student
- `violation_type`: Optional - Filter by violation type
- `start_date`: Optional - Filter by start date
- `end_date`: Optional - Filter by end date

**Response:**
```json
{
  "success": true,
  "message": "Violation frames retrieved successfully",
  "data": [
    {
      "id": 123,
      "quiz_id": 1,
      "student_username": "johndoe",
      "violation_type": "looking-away",
      "timestamp": "2025-05-13T10:15:30.000Z",
      "frame_data": "base64-encoded-image-data",
      "incident_count": 1,
      "created_at": "2025-05-13T10:15:31.000Z"
    }
  ]
}
```

## 4. Coordinator APIs

### Create Quiz

Creates a new quiz.

**Endpoint:** `POST /api/quizzes`

**Authentication:** Required (Coordinator)

**Request Body:**
```json
{
  "title": "Python Basics",
  "description": "Test your knowledge of Python fundamentals",
  "duration": 30,
  "scheduled_date": "2025-05-15T10:00:00.000Z",
  "deadline_date": "2025-05-20T10:00:00.000Z",
  "questions": [
    {
      "question_text": "What is the output of print(2 + 2)?",
      "options": [
        {
          "option_text": "2",
          "is_correct": false
        },
        {
          "option_text": "4",
          "is_correct": true
        },
        {
          "option_text": "22",
          "is_correct": false
        },
        {
          "option_text": "Error",
          "is_correct": false
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Quiz created successfully",
  "quizId": 1
}
```

### Get Coordinator Quizzes

Retrieves all quizzes created by the coordinator.

**Endpoint:** `GET /api/quizzes`

**Authentication:** Required (Coordinator)

**Response:**
```json
[
  {
    "id": 1,
    "title": "Python Basics",
    "description": "Test your knowledge of Python fundamentals",
    "is_active": true,
    "scheduled_date": "2025-05-15T10:00:00.000Z",
    "deadline_date": "2025-05-20T10:00:00.000Z",
    "attempt_count": 5
  }
]
```

### Get Quiz Details (Coordinator)

Retrieves detailed information about a quiz including questions and correct answers.

**Endpoint:** `GET /api/quizzes/:id`

**Authentication:** Required (Coordinator)

**Parameters:**
- `id`: Quiz ID

**Response:**
```json
{
  "id": 1,
  "title": "Python Basics",
  "description": "Test your knowledge of Python fundamentals",
  "duration": 30,
  "scheduled_date": "2025-05-15T10:00:00.000Z",
  "deadline_date": "2025-05-20T10:00:00.000Z",
  "is_active": true,
  "questions": [
    {
      "id": 101,
      "question_text": "What is the output of print(2 + 2)?",
      "options": [
        {
          "id": 1001,
          "option_text": "2",
          "is_correct": false
        },
        {
          "id": 1002,
          "option_text": "4",
          "is_correct": true
        },
        {
          "id": 1003,
          "option_text": "22",
          "is_correct": false
        },
        {
          "id": 1004,
          "option_text": "Error",
          "is_correct": false
        }
      ]
    }
  ],
  "statistics": {
    "total_attempts": 5,
    "average_score": 78.5,
    "highest_score": 95.0
  }
}
```

### Update Quiz

Updates an existing quiz.

**Endpoint:** `PUT /api/quizzes/:id`

**Authentication:** Required (Coordinator)

**Parameters:**
- `id`: Quiz ID

**Request Body:**
```json
{
  "title": "Python Basics Updated",
  "description": "Updated description",
  "duration": 45,
  "scheduled_date": "2025-05-16T10:00:00.000Z",
  "deadline_date": "2025-05-21T10:00:00.000Z",
  "is_active": true,
  "questions": [
    // Updated question array
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Quiz updated successfully"
}
```

### Get Quiz Attempts

Retrieves all student attempts for a specific quiz.

**Endpoint:** `GET /api/quizzes/:id/attempts`

**Authentication:** Required (Coordinator)

**Parameters:**
- `id`: Quiz ID

**Response:**
```json
{
  "attempts": [
    {
      "id": 501,
      "student_username": "johndoe",
      "first_name": "John",
      "last_name": "Doe",
      "score": 8,
      "total_questions": 10,
      "completed_date": "2025-05-13T11:15:30.000Z",
      "auto_submitted": false,
      "security_violations": 0
    }
  ],
  "statistics": {
    "total_attempts": 1,
    "average_score": 80.0,
    "highest_score": 80.0
  }
}
```

## 5. Gemini AI APIs

### Generate Quiz Questions

Generates quiz questions using Google's Gemini AI.

**Endpoint:** `POST /api/gemini/generate-quiz`

**Authentication:** Required (Coordinator)

**Request Body:**
```json
{
  "topic": "Python programming fundamentals",
  "questionCount": 5
}
```

**Response:**
```json
{
  "success": true,
  "questions": [
    {
      "text": "What is the output of print(2 + 2)?",
      "options": [
        {
          "text": "2",
          "isCorrect": false
        },
        {
          "text": "4",
          "isCorrect": true
        },
        {
          "text": "22",
          "isCorrect": false
        },
        {
          "text": "Error",
          "isCorrect": false
        }
      ]
    }
    // Additional questions...
  ]
}
```

**Error Responses:**
- `400 Bad Request`: Invalid request parameters
- `500 Internal Server Error`: AI service unavailable or error

## 6. Helper Utility APIs

### Initialize Database

Initializes required database tables if they don't exist.

**Endpoint:** Internal function called on server start

**Response:** Logs console messages about table creation status

### Record Monitoring Session

Records when a face monitoring session begins.

**Endpoint:** Internal function called by monitoring APIs

**Parameters:**
- `quizId`: Quiz ID
- `studentId`: Student username
- `port`: WebSocket port used

**Response:** None (internal function)

## 7. Authentication Middleware

The isAuthenticated middleware protects API routes, checking if the user is logged in and redirecting to the homepage if not.

```javascript
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/');
};
```

## 8. Error Handling

All API endpoints include error handling that returns appropriate HTTP status codes:

- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Authentication required but not provided
- `403 Forbidden`: Authentication provided but not authorized
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server-side error

## 9. Content Types

- Request bodies should use `Content-Type: application/json`
- Form submissions use `Content-Type: application/x-www-form-urlencoded`
- File uploads use `Content-Type: multipart/form-data`
- Responses are returned as JSON

## 10. Rate Limiting

Rate limiting is applied to sensitive endpoints:

- Authentication endpoints: 5 requests per minute
- Quiz submission: 10 requests per minute

For additional API documentation or custom integrations, contact the development team.
