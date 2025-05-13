# Developer's Guide to Pragati

This technical documentation is intended for developers who need to understand, maintain, or extend the Pragati Online Exam Platform.

## 1. System Architecture

### Technical Stack

The Pragati platform uses the following technologies:

- **Backend**: Node.js v14+ with Express.js framework
- **Frontend**: EJS templates, JavaScript, CSS
- **Database**: MySQL 8.0+
- **Authentication**: bcrypt for password hashing
- **Session Management**: express-session middleware
- **Face Detection**: Python with OpenCV and WebSockets
- **AI Integration**: Google Gemini API

### Directory Structure

```
/Pragati-1/
├── docs/                  # Documentation files
├── public/                # Static assets
│   ├── assets/            # CSS, JS and images
│   ├── evidence/          # Security evidence files
│   ├── uploads/           # User uploaded files
├── routes/                # Express route handlers
├── views/                 # EJS template files
├── server.js              # Main application entry point
├── face_monitor.py        # Python face detection script
├── face_monitor_service.js # Face monitoring service
├── db-pool.js             # Database connection pool
├── .env                   # Environment configuration
└── package.json           # Node.js dependencies
```

## 2. Key Components

### Server Setup (server.js)

The main server file handles:

- Express application setup
- Middleware configuration
- Route definitions
- Database connection pool
- Authentication middleware
- Server initialization

### Database Structure

The MySQL database contains the following key tables:

- **students**: Student user accounts
- **coordinators**: Coordinator user accounts
- **quizzes**: Quiz metadata and settings
- **questions**: Quiz questions
- **options**: Question options
- **quiz_attempts**: Student quiz submissions
- **quiz_answers**: Individual question answers
- **quiz_security_logs**: Security violation logs
- **quiz_violation_frames**: Captured violation evidence
- **monitoring_sessions**: Active monitoring session data

### Authentication System

Authentication is handled via:

- Express sessions with secure cookies
- bcrypt password hashing
- Role-based access control
- Session timeout handling

### Face Monitoring System

The face monitoring consists of:

1. **face_monitor_service.js**: Node.js service that:
   - Manages Python process instances
   - Handles WebSocket port allocation
   - Processes violation frames
   - Updates the database

2. **face_monitor.py**: Python script that:
   - Accesses webcam via browser
   - Detects faces and eyes
   - Monitors attention
   - Sends violation data via WebSocket

## 3. API Endpoints

### Authentication Endpoints

- `POST /register`: Create new student or coordinator account
- `POST /loginStudent`: Student login
- `POST /loginCoordinator`: Coordinator login
- `GET /logout`: Log out current user

### Student Endpoints

- `GET /api/availableQuizzes`: List available quizzes
- `GET /api/quiz/:id`: Get quiz data
- `POST /api/quiz/:id/submit`: Submit quiz answers
- `GET /api/student/stats`: Get student statistics

### Coordinator Endpoints

- `POST /api/quizzes`: Create new quiz
- `GET /api/quizzes`: List coordinator's quizzes
- `GET /api/quizzes/:id`: Get detailed quiz information
- `PUT /api/quizzes/:id`: Update quiz
- `GET /api/quizzes/:id/attempts`: List quiz attempts

### Security Endpoints

- `POST /api/quiz/:id/start-monitoring`: Start face monitoring session
- `POST /api/quiz/:id/stop-monitoring`: Stop face monitoring session
- `POST /api/quiz/security-issue`: Record browser security violation
- `POST /api/quiz/face-monitoring-issue`: Record face monitoring violation
- `GET /api/quiz/get-violation-frames`: Get violation evidence frames

### Gemini AI Endpoints

- `POST /api/gemini/generate-quiz`: Generate AI quiz questions

## 4. Database Connection Pool

The database connection pool (`db-pool.js`) provides:

- Efficient connection reuse
- Connection limiting
- Error handling
- Query timeout handling

Usage example:

```javascript
const pool = require('./db-pool.js');

async function getUserData(userId) {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute(
            'SELECT * FROM users WHERE id = ?',
            [userId]
        );
        return rows[0];
    } finally {
        connection.release(); // Always release the connection
    }
}
```

## 5. Face Monitoring Implementation

### Starting a Monitoring Session

```javascript
const faceMonitorService = require('./face_monitor_service');

// Create a unique session identifier
const sessionId = `${studentId}_${quizId}`;

// Start the monitoring session
const monitoringInfo = await faceMonitorService.startMonitoringSession(sessionId, {
    student_id: studentId,
    quiz_id: quizId
});

// Return WebSocket port for frontend connection
return {
    success: true,
    websocketPort: monitoringInfo.websocketPort
};
```

### Frontend WebSocket Connection

```javascript
// Connect to WebSocket server
const websocket = new WebSocket(`ws://localhost:${websocketPort}`);

// Set up event handlers
websocket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    
    // Handle face monitoring data
    if (data.looking_away) {
        // Handle looking away violation
    }
    
    if (data.multi_face) {
        // Handle multiple faces violation
    }
    
    // Update UI with webcam feed
    if (data.image) {
        updateVideoFeed(data.image);
    }
};
```

## 6. Security Implementation Details

### Fullscreen Enforcement

```javascript
// Request fullscreen mode
function enterFullscreenAndStartQuiz() {
    const docElement = document.documentElement;
    
    if (docElement.requestFullscreen) {
        docElement.requestFullscreen().then(startQuiz);
    } else if (docElement.mozRequestFullScreen) {
        docElement.mozRequestFullScreen();
        startQuiz();
    } else if (docElement.webkitRequestFullscreen) {
        docElement.webkitRequestFullscreen();
        startQuiz();
    }
}

// Detect fullscreen exit
document.addEventListener('fullscreenchange', handleFullscreenChange);
```

### Tab Switching Detection

```javascript
// Set up visibility detection
function setupVisibilityDetection() {
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

// Handle visibility changes
function handleVisibilityChange() {
    if (document.hidden && quizActive) {
        recordSecurityIssue('tab-switched');
    }
}
```

### DevTools Detection

Multiple methods are used to detect browser developer tools:

```javascript
// Size-based detection
const widthThreshold = window.outerWidth - window.innerWidth > threshold;
const heightThreshold = window.outerHeight - window.innerHeight > threshold;

// Console timing detection
const startTime = new Date();
debugger;
const endTime = new Date();
if (endTime - startTime > 100) {
    // DevTools breakpoint detected
}
```

## 7. Common Development Tasks

### Adding a New API Endpoint

1. Identify the appropriate route file or create a new one
2. Add the route handler function
3. Apply authentication middleware if needed
4. Implement input validation
5. Handle database operations
6. Return appropriate responses

Example:

```javascript
// Add a new API endpoint
app.get('/api/student/quiz-history', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'student') {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM quiz_attempts WHERE student_username = ?',
                [req.session.user.id]
            );
            
            res.json(rows);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error fetching quiz history:', err);
        res.status(500).json({ message: 'Failed to fetch quiz history' });
    }
});
```

### Extending the Face Monitoring System

To add new detection capabilities:

1. Modify `face_monitor.py` to include new detection logic
2. Update the WebSocket message format to include new data
3. Enhance `face_monitor_service.js` to process new violation types
4. Add frontend handling for new violation types

### Adding New Question Types

To support a new question type (e.g., matching):

1. Update the database schema to support the new format
2. Modify the quiz creation interface
3. Update the quiz display logic
4. Enhance the answer validation and scoring system

## 8. Error Handling Best Practices

- Always use try/catch blocks around async operations
- Release database connections in finally blocks
- Log errors with appropriate context
- Return user-friendly error messages
- Use HTTP status codes correctly

Example:

```javascript
try {
    // Some operation that might fail
} catch (err) {
    console.error('Context-specific error message:', err);
    return res.status(500).json({ 
        message: 'User-friendly error message' 
    });
} finally {
    // Cleanup resources if necessary
}
```

## 9. Testing and Debugging

### Manual Testing Checklist

- Authentication flow
- Quiz creation and editing
- Quiz taking from student perspective
- Face monitoring detection accuracy
- Security violation detection
- Quiz grading accuracy

### Common Debug Points

- Check browser console for frontend errors
- Verify WebSocket connections in Network tab
- Monitor server logs for backend issues
- Examine database queries for performance
- Test webcam access in different browsers

## 10. Deployment Considerations

### Environment Configuration

Critical environment variables:

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: Database connection
- `SESSION_SECRET`: For secure session cookies
- `GEMINI_API_KEY`: For AI question generation
- `NODE_ENV`: Set to 'production' for production environments

### Production Best Practices

- Use TLS/SSL for all connections
- Set secure and HttpOnly flags on cookies
- Implement rate limiting on sensitive endpoints
- Configure appropriate CORS settings
- Set up proper logging and monitoring

For additional development guidance, contact the lead developer.
