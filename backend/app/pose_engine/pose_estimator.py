"""Server-side pose estimation for a single JPEG frame.

OpenCV decodes the image bytes; MediaPipe's Pose solution finds the 33
BlazePose landmarks. This is the optional server-side counterpart to the
primary, real-time client-side pipeline in
frontend/src/hooks/usePoseDetection.js. Reach for this when a team member
wants to keep pose math in Python, or to re-analyze an uploaded clip.
"""
from __future__ import annotations

import cv2
import mediapipe as mp
import numpy as np

_pose_landmarker = mp.solutions.pose.Pose(
    static_image_mode=True,
    model_complexity=1,
    min_detection_confidence=0.5,
)


def landmarks_from_jpeg_bytes(jpeg_bytes: bytes) -> list[dict] | None:
    arr = np.frombuffer(jpeg_bytes, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        return None

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    result = _pose_landmarker.process(rgb)
    if not result.pose_landmarks:
        return None

    return [
        {"x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility}
        for lm in result.pose_landmarks.landmark
    ]
