# Face Monitoring System - Technical Documentation

This guide explains the face monitoring system used in the Pragati Online Exam Platform for detecting and preventing exam violations through webcam-based proctoring.

## 1. System Overview

The face monitoring system is a critical security component that:
- Detects the presence or absence of a student's face
- Identifies multiple faces in the webcam feed
- Monitors student attention during exams
- Records violations for review by coordinators
- Auto-submits exams in case of serious security violations

## 2. Technical Architecture

The face monitoring system uses a client-server architecture with:

1. **Python Backend**: OpenCV-based face detection service
2. **WebSocket Communication**: Real-time data transfer between Python and browser
3. **Node.js Service Layer**: Management of monitoring sessions and database integration
4. **Browser Integration**: JavaScript client for capturing and displaying webcam feed

### Component Flow

```
Browser Webcam → WebSocket → Python OpenCV Service → WebSocket → Browser UI
                                     ↓
                             Violation Detection → Database Storage
```

## 3. Setting Up the Face Monitoring Service

The system requires the following components:

1. **Python with OpenCV**: For face detection processing
2. **WebSockets**: For real-time communication
3. **Database Tables**: For storing violation frames

### Prerequisites

- Python 3.7+ with the following packages:
  - OpenCV (cv2)
  - NumPy
  - websockets
  - base64
  - requests

- Node.js modules:
  - child_process
  - WebSocket

### Configuration

The face monitoring service is configured in the `face_monitor_service.js` file:

- `PORT_RANGE_START` and `PORT_RANGE_END`: Define the range of WebSocket ports
- `warning_threshold`: Time in seconds before a violation is triggered (default: 8)
- `early_warning_threshold`: Time for initial warnings (default: 4)

## 4. How Face Monitoring Works

### Detection Process

1. When a student starts a quiz in fullscreen mode, the system:
   - Initiates a WebSocket connection to the Python service
   - Starts capturing webcam frames
   - Analyzes frames for faces using cascade classifiers

2. The system continuously monitors for:
   - **Face Presence**: Detects if the student's face is visible
   - **Multiple Faces**: Checks if more than one face is in the frame
   - **Attention**: Uses eye detection to determine if the student is looking at the screen
   - **Glasses**: Uses specialized detection for students wearing glasses

### Violation Handling

Violations are processed in stages:

1. **Early Warning**: Visual alert after 4 seconds of violation
2. **Serious Warning**: Enhanced alert after 6 seconds
3. **Critical Violation**: Auto-submission after 8+ seconds of continuous violation

For each violation:
- A screenshot is captured and stored
- Violation details are logged in the database
- The student receives a visual warning
- Coordinators can review violations later

## 5. Database Integration

Violation data is stored in the `quiz_violation_frames` table:

- `quiz_id`: The quiz being taken
- `student_username`: The student being monitored
- `session_id`: Unique identifier for the monitoring session
- `violation_type`: Type of violation (e.g., "looking-away", "multiple-faces")
- `timestamp`: When the violation occurred
- `frame_data`: Base64-encoded screenshot
- `incident_count`: Number of occurrences of this violation type

## 6. Session Management

Each monitoring session is uniquely identified and managed:

- Sessions start when students begin quizzes
- Each session uses a dedicated WebSocket port
- Resources are cleaned up when sessions end
- Frame processing continues even after session termination

## 7. Troubleshooting

Common issues and solutions:

- **Camera Access Denied**: Ensure browser permissions are granted
- **Face Not Detected**: Improve lighting or camera position
- **False Positives**: Adjust threshold values in face_monitor.py
- **WebSocket Connection Failures**: Check network configuration and firewall settings

## 8. Security Considerations

The face monitoring system implements several security measures:

- All violation frames are transmitted securely
- Stored frames are accessible only to authorized coordinators
- Monitoring is active only during quiz sessions
- Students are clearly informed about monitoring before quizzes

## 9. Performance Optimization

To ensure smooth operation:

- Frames are resized before processing
- Processing is optimized to maintain at least 5 FPS
- Multiple face detection algorithms are used for reliability
- Session cleanup routines prevent resource leaks

For technical support or advanced configuration, please contact the system administrator.
