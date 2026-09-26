"""Per-frame face skin color for rPPG, built for people standing back from
the camera (whole body in frame, so the face may be only 30-60 px wide).

Faces are found with OpenCV's YuNet detector (cv2.FaceDetectorYN, model in
./models) rather than MediaPipe Face Mesh: Face Mesh's detector is a
short-range (~2 m) model, while YuNet still finds faces ~28 px wide in a
1280x720 frame. github.com/hschn58/rPPG uses the same detector for its
standoff pipeline.

At that size the detector's box jitters about a pixel per frame, which
swamps the pulse if the skin region jumps with it. So the box is smoothed
over time, and the skin color is a Gaussian-weighted mean over the cheeks and
nose, centered at the box's sub-pixel position: weights fade out toward the
edge, so a small shift barely changes the result (a hard-edged region failed
most test clips; this one passed 30 px faces after browser-style encoding).
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

MODEL_PATH = Path(__file__).parent / "models" / "face_detection_yunet_2023mar.onnx"
SCORE_THRESHOLD = 0.6
BOX_SMOOTHING = 0.8  # weight of the previous box in the running average


def _largest_face(detector, image: np.ndarray) -> np.ndarray | None:
    """(x, y, w, h) of the largest face, i.e. the person nearest the camera."""
    detector.setInputSize((image.shape[1], image.shape[0]))
    _, faces = detector.detect(image)
    if faces is None or len(faces) == 0:
        return None
    return max(faces, key=lambda f: f[2] * f[3])[:4].astype(float)


def _cheek_color(frame: np.ndarray, box: np.ndarray) -> tuple[float, float, float] | None:
    """Gaussian-weighted mean RGB over the cheeks and nose of a face box."""
    x, y, w, h = box
    cx, cy, sx, sy = x + w / 2, y + h * 0.55, w * 0.22, h * 0.13
    x0, y0 = max(0, int(cx - 3 * sx)), max(0, int(cy - 3 * sy))
    x1, y1 = min(frame.shape[1], int(cx + 3 * sx) + 1), min(frame.shape[0], int(cy + 3 * sy) + 1)
    if x1 <= x0 or y1 <= y0:
        return None
    weights = np.outer(
        np.exp(-0.5 * ((np.arange(y0, y1) - cy) / sy) ** 2),
        np.exp(-0.5 * ((np.arange(x0, x1) - cx) / sx) ** 2),
    )[..., None]
    b, g, r = (frame[y0:y1, x0:x1] * weights).sum(axis=(0, 1)) / weights.sum()
    return r, g, b


def sample_skin_colors(frames) -> np.ndarray:
    """(T, 3) mean cheek/nose RGB per BGR frame, NaN rows where no face."""
    detector = cv2.FaceDetectorYN_create(str(MODEL_PATH), "", (320, 320), SCORE_THRESHOLD)
    box = None
    rgb = []
    for frame in frames:
        found = _largest_face(detector, frame)
        if found is None:
            box = None  # face lost: start fresh when it comes back
        else:
            box = found if box is None else BOX_SMOOTHING * box + (1 - BOX_SMOOTHING) * found
        color = _cheek_color(frame, box) if box is not None else None
        rgb.append(color if color is not None else (np.nan,) * 3)
    return np.array(rgb, dtype=float).reshape(-1, 3)
