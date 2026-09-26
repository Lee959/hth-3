"""Contactless heart rate from webcam video (remote photoplethysmography),
computed locally with OpenCV instead of a third-party API.

face_roi.py finds the face (YuNet) and averages its skin color each frame;
pulse.py turns that color trace into a heart rate. See docs/ARCHITECTURE.md.
"""
from __future__ import annotations

import os
import tempfile

import cv2
import numpy as np

from .face_roi import sample_skin_colors
from .pulse import NoPulseReading, PulseEstimate, estimate_pulse

__all__ = ["NoPulseReading", "PulseEstimate", "measure_heart_rate"]


def _read_frames(capture, times_ms: list):
    """Yields frames one at a time (a 720p clip held whole would be ~1 GB),
    recording each one's timestamp into `times_ms`."""
    ok, frame = capture.read()
    while ok:
        times_ms.append(capture.get(cv2.CAP_PROP_POS_MSEC))
        yield frame
        ok, frame = capture.read()


def measure_heart_rate(video_bytes: bytes, suffix: str = ".webm") -> PulseEstimate:
    """Heart rate from one recorded clip (webm/mp4 bytes, as MediaRecorder
    produces). Raises NoPulseReading if the clip can't support a reading."""
    times_ms: list = []
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "clip" + suffix)
        with open(path, "wb") as f:
            f.write(video_bytes)
        capture = cv2.VideoCapture(path, cv2.CAP_FFMPEG)
        try:
            if not capture.isOpened():
                raise NoPulseReading("couldn't decode the video clip")
            fps = capture.get(cv2.CAP_PROP_FPS)
            rgb = sample_skin_colors(_read_frames(capture, times_ms))
        finally:
            capture.release()
    if not times_ms:
        raise NoPulseReading("couldn't decode the video clip")

    # Browser recordings have a variable frame rate, so use each frame's own
    # timestamp; fall back to the nominal rate if the container lacks them.
    times = np.asarray(times_ms) / 1000.0
    if len(times) < 2 or np.any(np.diff(times) <= 0):
        times = np.arange(len(times)) / (fps if 1 <= fps <= 240 else 30.0)

    return estimate_pulse(times, rgb)
