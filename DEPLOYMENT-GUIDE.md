# 🚀 Free Deployment Guide

## Deploy Your Project for FREE on Render.com

### Prerequisites
- GitHub account
- Render.com account (sign up at https://render.com)

---

## Step 1: Prepare Your Code

### 1.1 Push to GitHub
```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Quiz and Face Monitoring System"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy on Render

### 2.1 Create Web Service
1. Go to https://render.com and sign in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `quiz-monitoring-system` (or any name)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Select **"Free"**

### 2.2 Set Environment Variables
In Render dashboard, go to **Environment** tab and add:

```
DB_HOST=<your-database-host>
DB_USER=<your-database-user>
DB_PASSWORD=<your-database-password>
DB_NAME=<your-database-name>
DB_PORT=3306
SESSION_SECRET=<generate-random-string-here>
NODE_ENV=production
```

---

## Step 3: Database Options

### 🌟 **RECOMMENDED: PlanetScale (Best Free Option)**

**10GB storage, serverless MySQL, totally FREE!**

1. **Sign up**: https://planetscale.com
2. **Create database**:
   - Click "Create a database"
   - Name: `quiz-system`
   - Region: Select nearest
   - Plan: **Hobby (Free)** - 10GB storage
3. **Create branch**: `main` (auto-created)
4. **Get credentials**:
   - Click "Connect"
   - Framework: "General"
   - Copy connection details
5. **Import schema**:
   - Use PlanetScale web console "Console" tab
   - Or use MySQL CLI with connection string
6. **Add to Render environment variables** (see Step 2.2 above)

---

### Alternative Database Options:

#### **Option B: Railway** ($5 free credit monthly)
1. Go to https://railway.app
2. New Project → Provision MySQL
3. Copy credentials from Variables tab
4. Import `database-schema.sql`
5. **Note**: $5 credit renews monthly

#### **Option C: Render PostgreSQL** (Free, same platform)
1. In Render dashboard → New → PostgreSQL
2. Free plan available
3. Requires converting MySQL to PostgreSQL syntax

#### **Option D: FreeSQLDatabase.com** (Quick testing only)
1. Go to https://www.freesqldatabase.com
2. Fill form → Get instant credentials
3. Use phpMyAdmin to import schema
4. **Note**: Limited resources, good for testing

📖 **Detailed setup guide**: See [FREE-MYSQL-SETUP.md](FREE-MYSQL-SETUP.md)

---

## Step 4: Import Database Schema

After database is created, import your schema:

### Using Command Line:
```bash
mysql -h <HOST> -P <PORT> -u <USER> -p <DATABASE_NAME> < database-schema.sql
```

### Using MySQL Workbench:
1. Download MySQL Workbench (free)
2. Create new connection with your database credentials
3. File → Run SQL Script → Select `database-schema.sql`
4. Execute

### Using phpMyAdmin:
1. Login to phpMyAdmin (if provided by your host)
2. Select your database
3. Click "Import" tab
4. Choose `database-schema.sql`
5. Click "Go"

### Test Your Database Connection:
```bash
npm run test:db
```

This will verify your database connection and show all tables.

---

## Step 5: Deploy! 🎉

1. Click **"Create Web Service"** on Render
2. Wait for deployment (5-10 minutes)
3. Your app will be live at: `https://your-app-name.onrender.com`

---

## Alternative Free Options

### 1. **Railway.app** (Easy + $5 free credit/month)
   - Visit: https://railway.app
   - Connect GitHub
   - Add MySQL database
   - Auto-deploys

### 2. **Fly.io** (More technical)
   - Visit: https://fly.io
   - Free tier available
   - Requires Docker setup

### 3. **Glitch.com** (Quick & Easy)
   - Visit: https://glitch.com
   - Import from GitHub
   - No database included (use external DB)

---

## Important Notes

⚠️ **Free Tier Limitations:**
- App may sleep after 15 minutes of inactivity (wakes on request)
- Limited bandwidth and compute
- Database storage limits

✅ **For Resume:**
Your live project URL will look like:
- Render: `https://quiz-system.onrender.com`
- Railway: `https://quiz-system.up.railway.app`

---

## Troubleshooting

### App won't start?
- Check logs in Render dashboard
- Verify all environment variables are set
- Ensure database connection is working

### Database connection error?
- Verify DB credentials
- Check if database server allows external connections
- Use correct DB_HOST and DB_PORT

### Need help?
- Render Docs: https://render.com/docs
- Railway Docs: https://docs.railway.app

---

## 🎓 Adding to Resume

**Project Title**: Quiz Management System with Face Monitoring

**Live Demo**: https://your-app-name.onrender.com

**Tech Stack**: Node.js, Express, MySQL, Face-API, EJS, Real-time Monitoring

**Features**:
- Student & Coordinator authentication
- Quiz creation and management
- Face detection monitoring during exams
- Session management
- Admin dashboard

---

Good luck! 🚀
