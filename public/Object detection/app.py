from flask import Flask, render_template, Response
import cv2
import time
from ultralytics import YOLO

app = Flask(__name__)

# Load YOLO model
model = YOLO("yolov8n.pt")

FOCAL_LENGTH = 700
last_update_time = 0
latest_text = "Waiting for detection..."

# Start camera
cap = cv2.VideoCapture(0)

def estimate_distance(pixel_width):
    # Generic estimation (approximate for all objects)
    if pixel_width <= 0:
        return 0
    return round((0.5 * FOCAL_LENGTH) / pixel_width, 2)

def generate_frames():
    global last_update_time, latest_text

    while True:
        success, frame = cap.read()
        if not success:
            break

        results = model(frame)
        current_time = time.time()

        for r in results:
            for box in r.boxes:
                confidence = float(box.conf[0])
                if confidence < 0.6:
                    continue

                cls_id = int(box.cls[0])
                label = model.names[cls_id]

                x1, y1, x2, y2 = map(int, box.xyxy[0])
                pixel_width = x2 - x1

                distance = estimate_distance(pixel_width)

                if current_time - last_update_time >= 1.5:
                    latest_text = f"{label} detected - {distance} meters"
                    last_update_time = current_time

                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(frame, label, (x1, y1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        ret, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/text_feed')
def text_feed():
    return latest_text

if __name__ == "__main__":
    app.run(debug=True)
