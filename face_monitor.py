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
import os
from datetime import datetime
import requests

class FaceMonitor:
    def __init__(self, warning_threshold=8, early_warning_threshold=4):  # Added early warning threshold
        # Load the pre-trained face detector - try alternative face detectors if default one fails
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.alt_face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt.xml')
        self.alt2_face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')
        
        # Load the pre-trained eye detector
        self.eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        
        # Add eye detector specifically for glasses (different parameters)
        self.eye_glasses_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye_tree_eyeglasses.xml')
        
        # Variables for tracking attention
        self.looking_away = False
        self.away_start_time = 0
        self.away_duration = 0
        self.warning_shown = False
        self.early_warning_shown = False  # Track if early warning was shown
        self.warning_threshold = warning_threshold  # seconds
        self.early_warning_threshold = early_warning_threshold  # seconds
        self.should_continue = True
        
        # Add glasses detection tracking
        self.glasses_detected = False
        self.detection_confidence = 0  # 0-100 confidence score
        self.consecutive_glasses_detections = 0  # Track consecutive frames with glasses
        
        # Performance optimization variables
        self.frame_count = 0
        self.last_fps_time = time.time()
        self.frames_processed = 0
        self.fps = 0
        
        # Recovery tracking - to ensure student gets credit for returning attention
        self.recovery_frames_needed = 3  # Need 3 consecutive attention frames to cancel warning
        self.current_recovery_frames = 0  # Current streak of attention frames
        
        # Frame capture for violations
        self.violation_frames = []  # To store captured frames
        self.session_id = None  # Will be set when monitoring starts
        self.student_id = None  # Will be set when monitoring starts
        self.quiz_id = None  # Will be set when monitoring starts
        self.frames_captured = False  # Flag to track if frames have been captured for current violation
        
        # Count looking away incidents
        self.away_incidents_count = 0  # Count incidents where student looked away for > early_warning_threshold
        self.frames_folder = "violation_frames"  # Folder to store captured frames
        
        # Create frames folder if it doesn't exist
        os.makedirs(self.frames_folder, exist_ok=True)
        
    def capture_violation_frames(self, frame, violation_type):
        """Capture frames for a violation event and send to database"""
        try:
            # Generate timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            
            # Get ISO format timestamp for database
            iso_timestamp = datetime.now().isoformat()
            
            # Encode the frame for sending to server
            encoded_frame = self.encode_frame_to_base64(frame)
            
            # Create payload for API request
            payload = {
                "quiz_id": self.quiz_id,
                "student_username": self.student_id,
                "violation_type": violation_type,
                "frame_data": encoded_frame,
                "timestamp": iso_timestamp
            }
            
            # Send frame to server API endpoint
            try:
                # Send the API request to store frame in database
                response = requests.post(
                    'http://localhost:3000/api/quiz/store-violation-frame',
                    json=payload
                )
                
                if response.status_code == 200:
                    print(f"Successfully sent violation frame to database: {violation_type}")
                else:
                    print(f"Failed to send frame to database. Status: {response.status_code}, Response: {response.text}")
                    
                    # Fallback: Create folder and save to file if database store fails
                    violation_folder = os.path.join(self.frames_folder, f"{self.session_id}")
                    os.makedirs(violation_folder, exist_ok=True)
                    
                    # Save the frame locally as a backup
                    filename = f"{violation_folder}/violation_{violation_type}_{timestamp}.jpg"
                    cv2.imwrite(filename, frame)
                    print(f"Saved backup frame to file: {filename}")
            except Exception as e:
                print(f"Error sending frame to API: {e}")
                
                # Fallback: Create folder and save to file if API call fails
                violation_folder = os.path.join(self.frames_folder, f"{self.session_id}")
                os.makedirs(violation_folder, exist_ok=True)
                
                # Save the frame locally as a backup
                filename = f"{violation_folder}/violation_{violation_type}_{timestamp}.jpg"
                cv2.imwrite(filename, frame)
                print(f"Saved backup frame to file: {filename}")
            
            # Add frame info to the local collection (for websocket feedback)
            self.violation_frames.append({
                "timestamp": timestamp,
                "type": violation_type,
                "image": encoded_frame,
                "session_id": self.session_id,
                "quiz_id": self.quiz_id,
                "student_id": self.student_id
            })
            
            self.frames_captured = True
            print(f"Captured violation frame at {timestamp}")
            return True
        except Exception as e:
            print(f"Error capturing violation frame: {e}")
            return False
    
    def encode_frame_to_base64(self, frame):
        """Encode a frame to base64 string"""
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 85]  # Higher quality for stored frames
        _, buffer = cv2.imencode('.jpg', frame)
        return base64.b64encode(buffer).decode('utf-8')
        
    async def process_frame(self, websocket, session_data=None):
        # Initialize websocket and session data
        if session_data:
            self.session_id = session_data.get('session_id', 'unknown')
            self.student_id = session_data.get('student_id', 'unknown')
            self.quiz_id = session_data.get('quiz_id', 'unknown')
        
        # Initialize webcam
        cap = cv2.VideoCapture(0)
        
        if not cap.isOpened():
            print("Error: Could not open webcam")
            return
            
        print("Starting face attention monitoring with improved glasses detection...")
        
        while self.should_continue:
            start_time = time.time()
            self.frame_count += 1
            
            # Read frame from webcam
            ret, frame = cap.read()
            if not ret:
                print("Failed to grab frame")
                await asyncio.sleep(0.1)
                continue
                
            # Use original frame directly without visual indicators
            display_frame = frame.copy()
            
            # Resize frame for faster processing (reduce to 50% size)
            frame_small = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
            
            # Convert to grayscale for detection
            gray = cv2.cvtColor(frame_small, cv2.COLOR_BGR2GRAY)
            
            # Improve contrast for better eye detection with glasses
            gray = cv2.equalizeHist(gray)
            
            # Only try alternative face detectors every 3 frames to improve performance
            if self.frame_count % 3 == 0:
                faces = self.face_cascade.detectMultiScale(gray, 1.3, 5)
                
                # Try alternatives only if needed
                if len(faces) == 0:
                    faces = self.alt_face_cascade.detectMultiScale(gray, 1.2, 5)
                    if len(faces) == 0:
                        faces = self.alt2_face_cascade.detectMultiScale(gray, 1.1, 5)
            else:
                # Just use main detector for most frames
                faces = self.face_cascade.detectMultiScale(gray, 1.3, 5)
            
            # Scale face coordinates back to original size
            if len(faces) > 0:
                scaled_faces = []
                for (x, y, w, h) in faces:
                    scaled_faces.append((x*2, y*2, w*2, h*2))
                faces = np.array(scaled_faces, dtype=np.int32)
            
            # Check if any face is detected and looking at screen
            current_looking_away = True
            self.glasses_detected = False
            self.detection_confidence = 0
            
            for (x, y, w, h) in faces:
                # Extract the face region of interest (from original size frame for better quality)
                roi_gray = cv2.cvtColor(frame[y:y+h, x:x+w], cv2.COLOR_BGR2GRAY)
                roi_gray = cv2.equalizeHist(roi_gray)  # Enhance contrast
                
                # Try to detect eyes with standard eye detector
                eyes = self.eye_cascade.detectMultiScale(roi_gray, 1.1, 3, minSize=(20, 20))
                
                # Optimized glasses detection - only check if regular eye detection failed
                if len(eyes) < 2:
                    # Apply additional pre-processing for better glasses detection
                    roi_gray_enhanced = cv2.GaussianBlur(roi_gray, (5, 5), 0)
                    
                    # First check for glasses specifically - use more aggressive parameters
                    eyes_glasses = self.eye_glasses_cascade.detectMultiScale(
                        roi_gray_enhanced, 
                        scaleFactor=1.1, 
                        minNeighbors=2,
                        minSize=(20, 20)
                    )
                    
                    # Focus on upper portion of face where glasses typically are
                    upper_face_roi = roi_gray[0:int(h*0.6), :]
                    upper_face_glasses = self.eye_glasses_cascade.detectMultiScale(
                        upper_face_roi,
                        scaleFactor=1.05,
                        minNeighbors=1,
                        minSize=(15, 15)
                    )
                    
                    # Combine detections
                    combined_eyes = list(eyes)
                    glasses_detected_count = 0
                    
                    if len(eyes_glasses) >= 1:
                        combined_eyes.extend(eyes_glasses)
                        self.glasses_detected = True
                        glasses_detected_count += len(eyes_glasses)
                    
                    if len(upper_face_glasses) >= 1:
                        # Adjust coordinates for the upper face region
                        for (ex, ey, ew, eh) in upper_face_glasses:
                            combined_eyes.append((ex, ey, ew, eh))
                        self.glasses_detected = True
                        glasses_detected_count += len(upper_face_glasses)
                    
                    eyes = combined_eyes
                
                # Update consecutive glasses detection counter
                if self.glasses_detected:
                    self.consecutive_glasses_detections += 1
                else:
                    self.consecutive_glasses_detections = max(0, self.consecutive_glasses_detections - 1)
                
                # Calculate confidence based on detections
                eye_count = len(eyes)
                
                # More sophisticated logic for determining if looking away
                if eye_count >= 2 or (eye_count >= 1 and (self.glasses_detected or self.consecutive_glasses_detections >= 2)):
                    current_looking_away = False
                    # Higher confidence with more eyes or consistent glasses detection
                    self.detection_confidence = min(100, 50 + 10 * eye_count)
                    if self.consecutive_glasses_detections >= 2:
                        self.detection_confidence = max(60, self.detection_confidence)
            
            # Handle looking away status
            if current_looking_away:
                # Reset recovery counter
                self.current_recovery_frames = 0
                
                if not self.looking_away:
                    # Just started looking away
                    self.looking_away = True
                    self.away_start_time = time.time()
                    self.frames_captured = False  # Reset frame capture flag for new violation
                
                # Calculate time spent looking away
                self.away_duration = time.time() - self.away_start_time
                
                # Show early warning if looking away for too long
                if self.away_duration >= self.early_warning_threshold and not self.early_warning_shown:
                    self.early_warning_shown = True
                    print(f"EARLY WARNING: Looking away for {self.away_duration:.1f} seconds!")
                    
                    # Capture frame for early warning
                    if not self.frames_captured:
                        self.capture_violation_frames(frame, "early_warning")
                
                # Show warning if looking away for too long (8+ seconds)
                if self.away_duration >= self.warning_threshold and not self.warning_shown:
                    self.warning_shown = True
                    print(f"WARNING: Looking away for {self.away_duration:.1f} seconds!")
                    
                    # Capture multiple frames for serious violation (8+ seconds)
                    if not self.frames_captured:
                        self.frames_captured = True
                        # Capture the current frame
                        self.capture_violation_frames(frame, "major_violation")
                        
                        # Capture 2 more frames with a slight delay for a series
                        for i in range(2):
                            await asyncio.sleep(0.5)  # Wait half a second
                            ret, extra_frame = cap.read()
                            if ret:
                                self.capture_violation_frames(extra_frame, f"major_violation_extra_{i+1}")
            else:
                # Student is looking at screen - handle recovery logic
                if self.looking_away:
                    # Just returned attention - increment recovery counter
                    self.current_recovery_frames += 1
                    
                    # Only reset warning status after consistent attention (3 frames)
                    if self.current_recovery_frames >= self.recovery_frames_needed:
                        # If this was a significant violation (4+ seconds), count it
                        if self.away_duration >= self.early_warning_threshold:
                            self.away_incidents_count += 1
                            print(f"Looking away incident #{self.away_incidents_count} recorded: {self.away_duration:.1f} seconds")
                            
                            # Check if this is the 3rd incident of significant duration
                            if self.away_incidents_count >= 3 and not self.frames_captured:
                                print(f"MULTIPLE VIOLATIONS: {self.away_incidents_count} incidents of looking away")
                                self.frames_captured = True
                                
                                # Capture multiple frames for repeat violations
                                self.capture_violation_frames(frame, "multiple_violations")
                                # Capture 2 more frames for a series
                                for i in range(2):
                                    await asyncio.sleep(0.5)  # Wait half a second
                                    ret, extra_frame = cap.read()
                                    if ret:
                                        self.capture_violation_frames(extra_frame, f"multiple_violations_extra_{i+1}")
                        
                        if self.warning_shown or self.early_warning_shown:
                            print("Student returned attention - canceling warning")
                        
                        # Reset the looking away status and warnings
                        self.looking_away = False
                        self.away_duration = 0
                        self.warning_shown = False
                        self.early_warning_shown = False
                else:
                    # Consistently looking at screen
                    self.away_duration = 0
                    self.warning_shown = False
                    self.early_warning_shown = False
            
            # Calculate and track FPS
            self.frames_processed += 1
            elapsed = time.time() - self.last_fps_time
            if elapsed >= 1.0:  # Update FPS every second
                self.fps = self.frames_processed / elapsed
                self.frames_processed = 0
                self.last_fps_time = time.time()
                print(f"FPS: {self.fps:.1f}")
            
            # Reduce JPEG quality for faster transmission (75% quality)
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 75]
            _, buffer = cv2.imencode('.jpg', display_frame, encode_param)
            jpg_as_text = base64.b64encode(buffer).decode('utf-8')
            
            # Send status update with image and looking_away duration
            message = {
                'looking_away': self.looking_away,
                'away_duration': self.away_duration,
                'image': jpg_as_text,
                'early_warning': self.away_duration >= self.early_warning_threshold,
                'auto_submit': self.away_duration >= self.warning_threshold,
                'glasses_detected': self.glasses_detected,
                'detection_confidence': self.detection_confidence,
                'fps': self.fps,
                'away_incidents_count': self.away_incidents_count,
                'frames_captured': len(self.violation_frames) > 0
            }
            
            try:
                await websocket.send(json.dumps(message))
            except websockets.exceptions.ConnectionClosed:
                print("Connection closed")
                break
            
            # Dynamic sleep based on processing time to maintain target frame rate
            # Target 10 FPS for smoother video but not excessive CPU usage
            process_time = time.time() - start_time
            sleep_time = max(0.01, (1/10) - process_time)  # Ensure at least 10ms sleep
            await asyncio.sleep(sleep_time)
        
        # Release resources
        cap.release()
        print("Face monitoring stopped")
        
        # Return captured violation frames
        return self.violation_frames

    def stop(self):
        self.should_continue = False

# Updated handler to work with newer websockets library versions
async def handler(websocket, path=None):
    # Extract session data from the URL query parameters if provided
    session_data = {}
    if path and '?' in path:
        query_string = path.split('?', 1)[1]
        try:
            for param in query_string.split('&'):
                key, value = param.split('=')
                session_data[key] = value
        except Exception as e:
            print(f"Error parsing URL parameters: {e}")
    
    print(f"Client connected with session data: {session_data}")
    monitor = FaceMonitor(warning_threshold=8)  # Changed from 10 to 8
    try:
        violation_frames = await monitor.process_frame(websocket, session_data)
        
        # If we have violation frames and the session ID was provided, save them
        if violation_frames and monitor.session_id != 'unknown':
            print(f"Collected {len(violation_frames)} violation frames for session {monitor.session_id}")
            
            # In a real implementation, you would send these to the server to store in the database
            # For now, we just save them as files locally
            try:
                # Create a JSON summary file with frame references
                summary_file = os.path.join(monitor.frames_folder, f"{monitor.session_id}", "violation_summary.json")
                with open(summary_file, 'w') as f:
                    summary_data = {
                        "session_id": monitor.session_id,
                        "quiz_id": monitor.quiz_id,
                        "student_id": monitor.student_id,
                        "total_frames": len(violation_frames),
                        "violations": [{"timestamp": frame["timestamp"], "type": frame["type"]} for frame in violation_frames]
                    }
                    json.dump(summary_data, f, indent=2)
                print(f"Saved violation summary to {summary_file}")
            except Exception as e:
                print(f"Error saving violation summary: {e}")
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