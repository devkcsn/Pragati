#!/usr/bin/env python
import cv2
import time
import numpy as np
import asyncio
import websockets
import json
import base64
import argparse
import sys

class FaceMonitor:
    def __init__(self, warning_threshold=8, early_warning_threshold=4):  # Added early warning threshold
        # Load the pre-trained face detector - use both default and alt for better detection
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.face_alt_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt.xml')
        
        # Load multiple eye detectors for better detection with glasses
        self.eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        self.eye_tree_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye_tree_eyeglasses.xml')
        
        # Variables for tracking attention
        self.looking_away = False
        self.away_start_time = 0
        self.away_duration = 0
        self.warning_shown = False
        self.early_warning_shown = False  # Track if early warning was shown
        self.warning_threshold = warning_threshold  # seconds
        self.early_warning_threshold = early_warning_threshold  # seconds
        self.should_continue = True
        
        # Multi-face detection variables
        self.face_count = 0
        self.multi_face_detected = False
    
    async def process_frame(self, websocket):
        # Initialize webcam
        cap = cv2.VideoCapture(0)
        
        if not cap.isOpened():
            print("Error: Could not open webcam")
            return
            
        print("Starting face attention monitoring...")
        
        while self.should_continue:
            # Read frame from webcam
            ret, frame = cap.read()
            if not ret:
                print("Failed to grab frame")
                await asyncio.sleep(0.1)
                continue
                
            # Use original frame directly without visual indicators
            display_frame = frame.copy()
            
            # Convert to grayscale for detection
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
              # Detect faces using multiple classifiers for improved accuracy
            faces1 = self.face_cascade.detectMultiScale(gray, 1.3, 5)
            faces2 = self.face_alt_cascade.detectMultiScale(gray, 1.3, 5)
            
            # Combine face detections from both classifiers
            faces = list(faces1) + list(faces2)
            
            # Remove duplicate detections (if a face is detected by both classifiers)
            if len(faces) > 0:
                # Convert faces to a NumPy array if it's not already
                faces = np.array(faces)
                
                # Track number of faces detected
                self.face_count = len(faces)
                self.multi_face_detected = self.face_count > 1
                
                # Check if any face is detected and looking at screen
                current_looking_away = True
                
                for (x, y, w, h) in faces:
                    # Extract the face region of interest
                    roi_gray = gray[y:y+h, x:x+w]
                    
                    # Try both eye detectors for better detection with glasses
                    # Regular eye detector
                    eyes = self.eye_cascade.detectMultiScale(roi_gray)
                    # Eye detector optimized for glasses
                    eyes_with_glasses = self.eye_tree_cascade.detectMultiScale(roi_gray)
                    
                    # Combine eye detections
                    all_eyes = list(eyes) + list(eyes_with_glasses)
                    
                    # If at least one eye is detected, consider the person is looking at the screen
                    # This is more permissive than before to handle glasses and different angles
                    if len(all_eyes) >= 1:
                        current_looking_away = False
                        break  # If any face is looking at the screen, consider attention detected
            else:
                # No faces detected
                self.face_count = 0
                self.multi_face_detected = False
                current_looking_away = True
            
            # If no faces detected or not enough eyes visible, consider looking away
            if current_looking_away:
                if not self.looking_away:
                    # Just started looking away
                    self.looking_away = True
                    self.away_start_time = time.time()
                    
                # Calculate time spent looking away
                self.away_duration = time.time() - self.away_start_time
                
                # Show early warning if looking away for too long
                if self.away_duration >= self.early_warning_threshold and not self.early_warning_shown:
                    self.early_warning_shown = True
                    print(f"EARLY WARNING: Looking away for {self.away_duration:.1f} seconds!")
                
                # Show warning if looking away for too long
                if self.away_duration >= self.warning_threshold and not self.warning_shown:
                    self.warning_shown = True
                    print(f"WARNING: Looking away for {self.away_duration:.1f} seconds!")
                
                # No text display on video frame
            else:
                # Reset the looking away status and warning
                self.looking_away = False
                self.away_duration = 0
                self.warning_shown = False
                self.early_warning_shown = False
                
                # No "Attention detected" message on video
            
            # Convert frame to JPEG for sending via websocket
            _, buffer = cv2.imencode('.jpg', display_frame)
            jpg_as_text = base64.b64encode(buffer).decode('utf-8')
              # Send status update with image and looking_away duration
            message = {
                'looking_away': self.looking_away,
                'away_duration': self.away_duration,
                'image': jpg_as_text,
                'early_warning': self.away_duration >= self.early_warning_threshold,
                'auto_submit': self.away_duration >= self.warning_threshold,
                'face_count': self.face_count,
                'multi_face': self.multi_face_detected
            }
            
            try:
                await websocket.send(json.dumps(message))
            except websockets.exceptions.ConnectionClosed:
                print("Connection closed")
                break
            
            # Small delay to prevent overloading
            await asyncio.sleep(0.1)
        
        # Release resources
        cap.release()
        print("Face monitoring stopped")

    def stop(self):
        self.should_continue = False

# Updated handler to work with newer websockets library versions
async def handler(websocket):
    # Path parameter is no longer needed in newer websockets versions
    print(f"Client connected")
    monitor = FaceMonitor(warning_threshold=8, early_warning_threshold=3)  # Lowered early warning for better responsiveness
    try:
        await monitor.process_frame(websocket)
    except Exception as e:
        print(f"Error in handler: {e}")
    finally:
        monitor.stop()
        print("Client disconnected")

async def main(host='localhost', port=8765):
    try:
        server = await websockets.serve(handler, host, port)
        print(f"Face monitoring server started at ws://{host}:{port}")
        await server.wait_closed()
    except Exception as e:
        print(f"Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Face Attention Monitoring WebSocket Server')
    parser.add_argument('--host', type=str, default='localhost', help='Host to bind the WebSocket server')
    parser.add_argument('--port', type=int, default=8765, help='Port to bind the WebSocket server')
    
    args = parser.parse_args()
    
    try:
        asyncio.run(main(host=args.host, port=args.port))
    except KeyboardInterrupt:
        print("Server stopped by user")