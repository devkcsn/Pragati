# Installation and Deployment Guide for Pragati

This guide provides step-by-step instructions for installing, configuring, and deploying the Pragati Online Exam Platform in various environments.

## 1. System Requirements

### Minimum Hardware Requirements

- **CPU**: Dual-core processor, 2.0 GHz or higher
- **RAM**: 4 GB minimum, 8 GB recommended
- **Disk Space**: 1 GB for application, plus storage for question banks and violation frames
- **Network**: Stable internet connection

### Software Prerequisites

- **Node.js**: v14.0 or higher
- **Python**: v3.7 or higher
- **MySQL**: v8.0 or higher
- **Web Browser**: Chrome 80+, Firefox 75+, Edge 80+

### Development Environment

- Git
- Code editor (VS Code recommended)
- Node.js and npm
- Python development tools

## 2. Local Installation

### Step 1: Clone the Repository

```bash
git clone <repository_url>
cd Pragati-1
```

### Step 2: Install Node.js Dependencies

```bash
npm install
```

This will install the following key packages:
- express
- express-session
- body-parser
- bcrypt
- node-cron
- cors
- dotenv
- mysql2
- ejs

### Step 3: Install Python Dependencies

```bash
pip install opencv-python
pip install numpy
pip install websockets
pip install requests
```

### Step 4: Database Setup

1. Create a MySQL database:

```sql
CREATE DATABASE pragati;
```

2. Import the database schema:

```bash
mysql -u username -p pragati < Pragati.sql
```

### Step 5: Environment Configuration

1. Create a `.env` file in the project root:

```
# Database Configuration
DB_HOST=localhost
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=pragati
DB_PORT=3306

# Session Configuration
SESSION_SECRET=choose_a_long_random_string_for_production_use

# Server Configuration
PORT=3000
NODE_ENV=development

# Gemini API Key
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### Step 6: Start the Server

```bash
node server.js
```

The server should start on port 3000 (or the port specified in your .env file).

## 3. Production Deployment

### Option 1: Standard Server Deployment

#### Preparing the Server

1. Install Node.js, Python, and MySQL on your server
2. Set up a domain name and configure DNS
3. Install and configure a reverse proxy (Nginx recommended)

#### Deployment Steps

1. Clone the repository on the server
2. Install dependencies as described in the local installation
3. Create a production `.env` file with appropriate settings
4. Set up SSL/TLS certificates
5. Configure the application as a service

#### Nginx Configuration Example

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Setting Up as a Service with systemd

Create a service file `/etc/systemd/system/pragati.service`:

```
[Unit]
Description=Pragati Online Exam Platform
After=network.target mysql.service

[Service]
Type=simple
User=nodeuser
WorkingDirectory=/path/to/Pragati-1
ExecStart=/usr/bin/node /path/to/Pragati-1/server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable pragati.service
sudo systemctl start pragati.service
```

### Option 2: Docker Deployment

#### Creating a Dockerfile

Create a `Dockerfile` in the project root:

```dockerfile
FROM node:14

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.json first for better caching
COPY package*.json ./
RUN npm install

# Copy Python requirements and install
COPY requirements.txt ./
RUN pip3 install -r requirements.txt

# Copy the rest of the application
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
```

#### Docker Compose Setup

Create a `docker-compose.yml` file:

```yaml
version: '3'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    depends_on:
      - db
    restart: always

  db:
    image: mysql:8
    volumes:
      - db_data:/var/lib/mysql
      - ./Pragati.sql:/docker-entrypoint-initdb.d/init.sql
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    restart: always

volumes:
  db_data:
```

#### Deploying with Docker Compose

```bash
docker-compose up -d
```

## 4. Database Management

### Initial Setup

The `Pragati.sql` file contains all necessary tables and initial data. Import it using:

```bash
mysql -u username -p pragati < Pragati.sql
```

### Database Backup

Regular backups are recommended:

```bash
mysqldump -u username -p pragati > pragati_backup_$(date +%Y%m%d).sql
```

Consider setting up a cron job for automated backups.

## 5. Security Hardening

For a production deployment:

1. **Firewall Configuration**:
   - Allow only necessary ports (80, 443, SSH)
   - Block all other incoming connections

2. **SSL/TLS Setup**:
   - Obtain SSL certificates (Let's Encrypt recommended)
   - Configure secure TLS protocols and ciphers

3. **File Permissions**:
   - Ensure proper ownership of files
   - Set restrictive permissions on sensitive files

4. **Environment Variables**:
   - Store sensitive information in environment variables
   - Never commit .env files to version control

## 6. Monitoring and Maintenance

### Log Management

Configure logging:

```javascript
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Performance Monitoring

Consider using:
- PM2 for process management
- Prometheus/Grafana for metrics
- ELK stack for log analysis

### Regular Maintenance Tasks

- Update Node.js packages regularly
- Update Python dependencies
- Run database optimizations periodically
- Rotate logs and maintain backups

## 7. Scaling Considerations

### Horizontal Scaling

For large deployments:

1. Use a load balancer to distribute traffic
2. Deploy multiple application instances
3. Scale database with read replicas
4. Implement caching layer with Redis

### Vertical Scaling

For moderate growth:

1. Increase server resources (CPU/RAM)
2. Optimize database queries
3. Implement query caching

## 8. Troubleshooting Common Issues

### Application Won't Start

- Check for proper Node.js version
- Verify all dependencies are installed
- Ensure MySQL service is running
- Check .env file configuration

### Database Connection Issues

- Verify database credentials
- Check network connectivity
- Ensure MySQL server is running and accessible
- Check firewall settings

### Face Monitoring Problems

- Verify Python and OpenCV installation
- Check webcam permissions in browsers
- Ensure WebSocket ports are accessible

### Performance Issues

- Monitor server resource usage
- Check for slow database queries
- Optimize image processing

## 9. Updating the Application

### Standard Update Process

1. Pull latest changes:
   ```bash
   git pull origin main
   ```

2. Install any new dependencies:
   ```bash
   npm install
   ```

3. Apply database migrations if needed:
   ```bash
   node migrate.js
   ```

4. Restart the application:
   ```bash
   systemctl restart pragati.service
   ```

For additional deployment assistance, contact the system administrator.
