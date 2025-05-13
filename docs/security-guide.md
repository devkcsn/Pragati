# Security Features Guide for Pragati

This document details the security measures implemented in the Pragati Online Exam Platform and provides best practices for maintaining exam integrity.

## 1. Overview of Security Features

The Pragati platform includes multiple layers of security to prevent cheating and maintain exam integrity:

- **Authentication Security**: Secure login systems
- **Exam Environment Protection**: Anti-tampering measures
- **Webcam-based Proctoring**: AI-powered face monitoring
- **Activity Monitoring**: Detection of suspicious behaviors
- **Violation Recording**: Evidence collection for review

## 2. Authentication Security

### Password Security

- Passwords are hashed using bcrypt with appropriate salt rounds
- Password requirements enforce minimum complexity standards
- Login attempts are rate-limited to prevent brute force attacks

### Session Management

- Sessions use HTTP-only cookies with secure flags (in production)
- Session expiration is set to 24 hours
- Session IDs are regenerated on privilege level changes

### Database Security

- Parameterized queries prevent SQL injection
- Input validation is performed on all user inputs
- Database credentials are stored in environment variables

## 3. Exam Security Features

The platform implements numerous countermeasures against common cheating methods:

### Browser Restrictions

- **Fullscreen Enforcement**: Exams must be taken in fullscreen mode
- **Tab Switching Detection**: Changing tabs/windows triggers a violation
- **Right-Click Prevention**: Blocking context menus prevents copying
- **Copy/Paste Prevention**: Keyboard shortcuts are disabled
- **Text Selection Prevention**: Prevents copying of quiz content
- **Developer Tools Detection**: Multiple methods detect browser dev tools

### Violation Detection

The system detects various types of violations:

| Violation Type | Detection Method | Action |
|----------------|-----------------|--------|
| Tab Switching | Document visibility API | Warning, then auto-submit |
| Exiting Fullscreen | Fullscreen API events | Auto-submit |
| Developer Tools | Multiple detection methods | Warning, then auto-submit |
| Multiple Faces | Face detection algorithm | Warning, then auto-submit |
| Looking Away | Face/eye monitoring | Warning, then auto-submit |
| Mobile Device | User-Agent detection | Blocked at server level |

## 4. Face Monitoring Security

The webcam-based proctoring system:

- Detects if a student is looking away from the screen
- Identifies if multiple people are visible in the frame
- Captures screenshots as evidence of violations
- Applies graduated response to violations:
  1. Early warning (4+ seconds)
  2. Critical warning (6+ seconds)
  3. Auto-submission (8+ seconds)

## 5. Violation Handling Protocol

When security violations occur:

1. The violation is logged in the database with timestamp
2. For serious violations, a screenshot is captured
3. The student receives a warning notification
4. After multiple or severe violations, the quiz auto-submits
5. Coordinators can review violations in the admin dashboard

## 6. Security Best Practices for Coordinators

When administering exams:

- **Question Randomization**: Enable question and answer randomization
- **Time Management**: Set appropriate time limits for quizzes
- **Question Banks**: Create larger question pools than needed for randomization
- **Review Security Logs**: Check for patterns of violations
- **Clear Instructions**: Inform students about security measures beforehand

## 7. Configuration Options

Security settings can be configured in:

- Environment variables (.env file)
- Server configuration (server.js)
- Quiz-specific settings when creating quizzes

## 8. Handling False Positives

To minimize false security violations:

- Ensure students have proper lighting for face detection
- Recommend wired internet connections for stability
- Advise students on proper webcam positioning
- Allow brief grace periods for network issues

## 9. Technical Security Details

For developers and system administrators:

- TLS/SSL is recommended for production deployments
- Security headers are implemented in Express
- Content Security Policy restricts resource loading
- Database connections use connection pooling
- Server-side validation complements client-side checks

## 10. Security Limitations

Be aware of the following limitations:

- Advanced screen-sharing techniques may not be detected
- Hardware-based cheating methods are not detectable
- Very similar-looking individuals might not trigger multiple face detection
- Network interruptions can affect monitoring continuity

For additional security features or custom configurations, please contact your system administrator.
