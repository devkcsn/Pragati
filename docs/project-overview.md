# Pragati Online Exam Platform - Project Overview

This document provides a comprehensive overview of the Pragati Online Exam Platform, its architecture, main components, and how they interact.

## 1. Introduction

Pragati is a secure online examination platform designed to facilitate remote test-taking with robust proctoring features. The platform provides a complete ecosystem for conducting and managing online examinations, including quiz creation, student authentication, exam proctoring, and result analysis.

## 2. System Architecture

The Pragati platform is built using a modern web technology stack:

- **Backend**: Node.js with Express framework
- **Frontend**: EJS templates with JavaScript
- **Database**: MySQL
- **Security**: bcrypt for password hashing
- **Session Management**: express-session
- **AI Integration**: Google's Gemini API
- **Face Monitoring**: Python with OpenCV and WebSockets

### Core Modules

The platform consists of several key modules:

1. **Authentication System**: Secure login/registration for students and coordinators
2. **Quiz Management**: Creating, scheduling, and managing quizzes
3. **Exam Proctoring**: Face monitoring and security violation detection
4. **Result Processing**: Automatic grading and analytics
5. **AI-Powered Question Generation**: Integration with Gemini AI for quiz generation

## 3. Authentication System

Pragati implements a role-based authentication system with two primary user roles:

- **Students**: Can take quizzes and view their results
- **Coordinators**: Can create quizzes, monitor progress, and view violation reports

The authentication system uses:
- Secure password hashing with bcrypt
- Session-based authentication with HTTP-only cookies
- Session expiration and security controls

## 4. Quiz Management

The quiz management module allows coordinators to:

- Create quizzes manually or with AI assistance
- Set duration and scheduling parameters
- Configure security settings
- Monitor quiz attempts in real-time
- View comprehensive analytics and statistics

## 5. Proctoring System

Pragati implements a sophisticated proctoring system to ensure exam integrity:

- **Face Detection**: Using computer vision to detect student presence
- **Multiple Face Detection**: Preventing unauthorized help
- **Tab Switching Detection**: Preventing access to unauthorized resources
- **Fullscreen Enforcement**: Ensuring the exam environment is controlled
- **Browser Console/DevTools Detection**: Preventing technical cheating methods
- **Violation Recording**: Capturing evidence of policy violations

## 6. Security Measures

The platform employs numerous security controls:

- Protection against SQL injection
- XSS prevention
- CSRF protection
- Input validation
- Secure password storage
- Rate limiting on sensitive endpoints

## 7. Integration Points

Pragati can integrate with:

- Google's Gemini API for AI-powered question generation
- Database systems for storing user data, questions, and results
- External notification systems (email/SMS)

## 8. Deployment Architecture

The platform is designed to be deployed as:

- A standalone server (single instance)
- Horizontally scalable instances behind a load balancer (for production environments)

Database connections are managed through connection pooling for optimal performance.

## 9. Future Roadmap

Planned features include:

- Enhanced analytics and reporting
- Integration with learning management systems
- Mobile application support
- Additional AI features for content creation and grading

For detailed documentation on specific components, please refer to the other guides in this documentation folder.
