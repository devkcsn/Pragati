# Quiz Management System with Face Monitoring 🎓

A comprehensive web-based quiz platform with real-time face detection monitoring to ensure exam integrity.

## 🌟 Features

- **User Authentication**: Separate login systems for students and coordinators
- **Quiz Management**: Create, edit, and manage quizzes
- **Face Monitoring**: Real-time face detection during exams using OpenCV and Python
- **WebSocket Integration**: Real-time monitoring with WebSocket communication
- **Admin Dashboard**: Monitor all activities and user management
- **Session Management**: Secure session handling
- **Responsive Design**: Works on desktop and mobile devices

## 🚀 Live Demo

**[View Live Project](https://your-app-url.onrender.com)** *(Add your deployed URL here)*

## 💻 Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Template Engine**: EJS
- **Authentication**: bcrypt, express-session
- **Face Detection**: Python, OpenCV (cv2), WebSockets
- **Real-time Communication**: WebSockets, asyncio
- **Scheduling**: node-cron
- **File Upload**: multer
- **Other**: Python-shell, numpy

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- MySQL database
- Python (for face monitoring service)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=quiz_db
DB_PORT=3306
SESSION_SECRET=your_secret_key
NODE_ENV=development
```

5. Import database schema:
```bash
mysql -u root -p quiz_db < database-schema.sql
```

6. Install Python dependencies:
```bash
pip install -r requirements.txt
```

7. Start the server:
```bash
# Development mode
npm run devStart

# Production mode
npm start
```

8. Open browser: `http://localhost:3000`

## 📁 Project Structure

```
├── server.js                 # Main server file
├── face_monitor.py           # Python face detection service
├── face_monitor_service.js   # Face monitoring Node.js service
├── public/                   # Static files
│   └── assets/
│       └── images/
├── views/                    # EJS templates
│   ├── admin-dashboard.ejs
│   ├── studentDashboard.ejs
│   ├── createQuiz.ejs
│   └── takeQuiz.ejs
├── package.json
└── .env.example
```

## 🔐 Default Users

See `adminLoginMethod.txt` for admin credentials.

## 🌐 Deployment

See [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) for detailed instructions on deploying to Render.com, Railway, or other platforms for FREE!

### ⚠️ Important: Face Monitoring Note

The face detection feature requires **webcam access** and will work locally but not on cloud deployments (Render, Railway, etc.) as cloud servers don't have webcams.

**For Portfolio/Resume:**
- ✅ Deploy the full backend to cloud (quiz management, auth, database)
- ✅ Record a demo video showing face monitoring working locally
- ✅ Include the video link and live backend URL in your resume

See [PRODUCTION-NOTES.md](PRODUCTION-NOTES.md) for detailed deployment strategy.

---

*(Add screenshots of your application here)*

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [ISC License](LICENSE).

## 👨‍💻 Author

**Your Name**
- GitHub: [@YourGitHub](https://github.com/YourGitHub)
- LinkedIn: [Your LinkedIn](https://linkedin.com/in/yourprofile)

## 🙏 Acknowledgments

- Face-API library for face detection
- Express.js community
- All contributors

---

⭐ If you found this project useful, please give it a star!
