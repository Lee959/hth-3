from flask import Blueprint, jsonify, request

from ..auth.decorators import requires_auth
from ..pose_engine.pose_estimator import landmarks_from_jpeg_bytes

pose_bp = Blueprint("pose", __name__)


@pose_bp.post("/analyze-frame")
@requires_auth
def analyze_frame():
    """Optional server-side spot-check: send one JPEG frame, get landmarks back.
    Primary real-time tracking happens client-side (see usePoseDetection.js)."""
    if "frame" not in request.files:
        return jsonify({"error": "multipart field 'frame' is required"}), 400

    landmarks = landmarks_from_jpeg_bytes(request.files["frame"].read())
    if landmarks is None:
        return jsonify({"error": "no person detected"}), 422

    return jsonify({"landmarks": landmarks})
