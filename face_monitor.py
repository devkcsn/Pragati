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
        
        # Eye detection parameters (added for better tuning)
        self.eye_min_neighbors = 2  # Lower value for more sensitive eye detection
        self.eye_scale_factor = 1.1  # Smaller step size for better detection
        self.eye_min_size = (20, 20)  # Minimum eye size to detect
        
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
        
        # Eye tracking variables (added)
        self.eye_detection_confidence = 0  # Confidence level for eye detection
        self.consecutive_no_eyes = 0  # Count frames with no eyes detected
    
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
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)            # Detect faces using multiple classifiers for improved accuracy
            # Use more generous parameters to detect faces at different distances and angles
            # scaleFactor=1.1 (was 1.3) means a smaller step size for better detection
            # minNeighbors=3 (was 5) means fewer confirmations needed to detect a face
            faces1 = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(30, 30))
            faces2 = self.face_alt_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(30, 30))
            
            # Process face detection results properly
            faces = []
            
            # Convert detection results to list of face rectangles
            if len(faces1) > 0:
                for face in faces1:
                    faces.append(face)
                    
            if len(faces2) > 0:
                for face in faces2:
                    faces.append(face)
            
            # Apply non-maximum suppression to remove overlapping detections
            if len(faces) > 0:
                # Convert to numpy array for processing
                faces_array = np.array(faces)
                final_faces = []
                
                # Simple non-maximum suppression (remove overlapping detections)
                # Use intersection-over-union to determine duplicates
                for i, face1 in enumerate(faces_array):
                    x1, y1, w1, h1 = face1
                    is_duplicate = False
                    
                    # Skip faces already marked as duplicates
                    for j, face2 in enumerate(faces_array[:i]):
                        x2, y2, w2, h2 = face2
                        
                        # Calculate overlap area
                        x_overlap = max(0, min(x1 + w1, x2 + w2) - max(x1, x2))
                        y_overlap = max(0, min(y1 + h1, y2 + h2) - max(y1, y2))
                        overlap_area = x_overlap * y_overlap
                        
                        # Calculate areas
                        area1 = w1 * h1
                        area2 = w2 * h2
                        
                        # If significant overlap, mark as duplicate
                        if overlap_area > 0.5 * min(area1, area2):
                            is_duplicate = True
                            break
                    
                    if not is_duplicate:
                        final_faces.append(face1)
                
                # Use the filtered faces list
                faces = final_faces
                
                # Track number of faces detected
                self.face_count = len(faces)
                self.multi_face_detected = self.face_count > 1
                
                # Check if any face is detected and looking at screen
                current_looking_away = True
                for (x, y, w, h) in faces:
                    # Extract the face region of interest
                    roi_gray = gray[y:y+h, x:x+w]
                    
                    # Focus on upper half of face for eye detection
                    # This improves accuracy by limiting the search area
                    eye_region_height = int(h * 0.5)  # Top half of face
                    roi_eyes = roi_gray[0:eye_region_height, 0:w]
                    
                    # Try both eye detectors with improved parameters
                    # Regular eye detector with tuned parameters
                    eyes = self.eye_cascade.detectMultiScale(
                        roi_eyes,
                        scaleFactor=self.eye_scale_factor,
                        minNeighbors=self.eye_min_neighbors,
                        minSize=self.eye_min_size
                    )
                    
                    # Eye detector optimized for glasses with tuned parameters
                    eyes_with_glasses = self.eye_tree_cascade.detectMultiScale(
                        roi_eyes,
                        scaleFactor=self.eye_scale_factor,
                        minNeighbors=self.eye_min_neighbors,
                        minSize=self.eye_min_size
                    )
                    
                    # Combine eye detections
                    all_eyes = list(eyes) + list(eyes_with_glasses)
                    
                    # Calculate eye detection confidence (0-100%)
                    # More eyes detected = higher confidence
                    eye_count = len(all_eyes)
                    self.eye_detection_confidence = min(100, eye_count * 50)  # 50% per eye, max 100%
                    
                    # If at least one eye is detected, consider the person is looking at the screen
                    if eye_count >= 1:
                        current_looking_away = False
                        self.consecutive_no_eyes = 0  # Reset counter
                        break  # If any face is looking at screen, consider attention detected            else:
                # No faces detected
                self.face_count = 0
                self.multi_face_detected = False
                current_looking_away = True
                self.consecutive_no_eyes += 1  # Increment counter for no eyes detected
            
            # If no faces detected or not enough eyes visible, consider looking away
            # Add some hysteresis to prevent rapid toggling
            if current_looking_away:
                if not self.looking_away:
                    # Just started looking away
                    self.looking_away = True
                    self.away_start_time = time.time()
                    print("Eye tracking: Student is looking away")
                    
                # Calculate time spent looking away
                self.away_duration = time.time() - self.away_start_time
                
                # Early warning at exactly 4 seconds as requested
                if self.away_duration >= 4.0 and not self.early_warning_shown:
                    self.early_warning_shown = True
                    print(f"EARLY WARNING: Looking away for {self.away_duration:.1f} seconds!")
                
                # Show warning if looking away for too long
                if self.away_duration >= self.warning_threshold and not self.warning_shown:
                    self.warning_shown = True
                    print(f"WARNING: Looking away for {self.away_duration:.1f} seconds!")
                
            else:
                # Reset the looking away status and warning                # Only reset if we're confident the student is looking at the screen
                if self.looking_away:
                    print("Eye tracking: Student is looking at screen again")
                
                self.looking_away = False
                self.away_duration = 0
                self.warning_shown = False
                self.early_warning_shown = False
            # No "Attention detected" message on video
            # Visualization code removed - no rectangles or face count display
            # Keep the detection logic but don't draw anything on the display frame
            
            # Convert frame to JPEG for sending via websocket
            _, buffer = cv2.imencode('.jpg', display_frame)
            jpg_as_text = base64.b64encode(buffer).decode('utf-8')
            # Send status update with image and looking_away duration            # Print face count info for debugging
            if self.multi_face_detected:
                print(f"Multiple faces detected: {self.face_count}")
            
            message = {
                'looking_away': self.looking_away,
                'away_duration': self.away_duration,
                'image': jpg_as_text,
                'early_warning': self.away_duration >= 4.0,  # Explicitly set to 4 seconds
                'auto_submit': self.away_duration >= self.warning_threshold,
                'face_count': self.face_count,
                'multi_face': self.multi_face_detected,
                'eye_detected': self.eye_detection_confidence > 0,  # Whether eyes are detected
                'eye_confidence': self.eye_detection_confidence  # Confidence level of eye detection
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
    monitor = FaceMonitor(warning_threshold=8, early_warning_threshold=4)  # Set early warning to exactly 4 seconds as requested
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