const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Map to store active monitoring processes by sessionID
const activeMonitors = new Map();

/**
 * Starts a face monitoring process for a specific quiz session
 * @param {string} sessionId - The unique session ID for this monitoring instance
 * @returns {Object} Information about the started process
 */
function startMonitoring(sessionId) {
    // Check if monitoring is already running for this session
    if (activeMonitors.has(sessionId)) {
        console.log(`Monitoring already active for session ${sessionId}`);
        return { 
            status: 'already_running',
            websocketPort: activeMonitors.get(sessionId).port
        };
    }
    
    // More robust port calculation - use a hash of the sessionId to generate a port number
    // Base port between 8765-9765
    const basePort = 8765;
    let portOffset = 0;
    
    // Create a simple numeric hash from the session ID
    for (let i = 0; i < sessionId.length; i++) {
        portOffset = (portOffset + sessionId.charCodeAt(i)) % 1000;
    }
    
    const port = basePort + portOffset;
    
    // Path to the Python script
    const scriptPath = path.join(__dirname, 'face_monitor.py');
    
    // Make sure Python script exists
    if (!fs.existsSync(scriptPath)) {
        console.error(`Error: Python script not found at ${scriptPath}`);
        throw new Error('Face monitoring script not found');
    }

    // Spawn Python process
    // Use 'python3' on Linux/production, 'python' on Windows/development
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    console.log(`Starting face monitoring at port ${port} for session ${sessionId}`);
    const monitor = spawn(pythonCmd, [scriptPath, '--host', 'localhost', '--port', port.toString()]);
    
    // Store process info
    const processInfo = {
        process: monitor,
        port: port,
        startTime: new Date()
    };
    
    activeMonitors.set(sessionId, processInfo);
    
    // Handle process output
    monitor.stdout.on('data', (data) => {
        console.log(`[Face Monitor ${sessionId}]: ${data}`);
    });
    
    monitor.stderr.on('data', (data) => {
        console.error(`[Face Monitor Error ${sessionId}]: ${data}`);
    });
    
    monitor.on('close', (code) => {
        console.log(`[Face Monitor ${sessionId}] exited with code ${code}`);
        activeMonitors.delete(sessionId);
    });

    // Add a small delay to ensure the server has time to start
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                status: 'started',
                websocketPort: port
            });
        }, 1000);
    });
}

/**
 * Stops the face monitoring process for a specific session
 * @param {string} sessionId - The unique session ID to stop monitoring for
 * @returns {boolean} Whether the process was successfully stopped
 */
function stopMonitoring(sessionId) {
    if (!activeMonitors.has(sessionId)) {
        console.log(`No active monitoring for session ${sessionId}`);
        return false;
    }
    
    const processInfo = activeMonitors.get(sessionId);
    
    // Kill the process
    processInfo.process.kill();
    activeMonitors.delete(sessionId);
    
    console.log(`Stopped monitoring for session ${sessionId}`);
    return true;
}

/**
 * Gets info about an active monitoring session
 * @param {string} sessionId - The unique session ID
 * @returns {Object|null} Information about the monitoring session or null if not found
 */
function getMonitoringInfo(sessionId) {
    if (!activeMonitors.has(sessionId)) {
        return null;
    }
    
    const info = activeMonitors.get(sessionId);
    return {
        port: info.port,
        active: true,
        startTime: info.startTime
    };
}

// Clean up all processes when the application exits
process.on('exit', () => {
    for (const [sessionId, info] of activeMonitors.entries()) {
        console.log(`Stopping monitoring for session ${sessionId} on application exit`);
        info.process.kill();
    }
});

module.exports = {
    startMonitoring,
    stopMonitoring,
    getMonitoringInfo
};