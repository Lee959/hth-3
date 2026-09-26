from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request

from ..auth.decorators import requires_auth
from ..extensions import db
from ..models import VitalsReading, WorkoutSession
from ..services import presage_client
from ..timeutil import parse_timestamp

vitals_bp = Blueprint("vitals", __name__)

# Clip length assumed when the client doesn't say (useVitalsUpload's default chunkMs).
DEFAULT_CLIP_SEC = 20.0


@vitals_bp.post("/<int:session_id>/chunks")
@requires_auth
def upload_chunk(session_id: int):
    """Accepts one recorded video chunk (see frontend useVitalsUpload hook),
    forwards it to Presage, and stores the resulting reading.

    Optional form fields `started_at` (ISO 8601 or epoch ms) and
    `duration_sec` say when the clip was filmed. Without them the clip is
    assumed to have just ended when the upload arrived."""
    received_at = datetime.now(timezone.utc)  # before Presage, which can take ~30s
    WorkoutSession.query.get_or_404(session_id)

    if "chunk" not in request.files:
        return jsonify({"error": "multipart field 'chunk' is required"}), 400

    try:
        window_sec = float(request.form.get("duration_sec") or DEFAULT_CLIP_SEC)
        clip_started_at = parse_timestamp(request.form.get("started_at"))
    except ValueError:
        return jsonify({"error": "started_at must be ISO 8601 or epoch ms; duration_sec a number"}), 400
    if clip_started_at is None:
        clip_started_at = received_at - timedelta(seconds=window_sec)

    file = request.files["chunk"]
    results = presage_client.analyze_video_chunk(file.read(), content_type=file.mimetype)

    reading = VitalsReading(
        session_id=session_id,
        recorded_at=clip_started_at,
        window_sec=window_sec,
        heart_rate_bpm=results.get("pulse_rate"),
        breathing_rate_bpm=results.get("breathing_rate"),
        hrv_ms=results.get("hrv"),
    )
    db.session.add(reading)
    db.session.commit()
    return jsonify(reading.to_dict()), 201


@vitals_bp.get("/<int:session_id>")
@requires_auth
def list_vitals(session_id: int):
    readings = (
        VitalsReading.query.filter_by(session_id=session_id)
        .order_by(VitalsReading.recorded_at.desc())
        .limit(50)
        .all()
    )
    return jsonify([r.to_dict() for r in readings])
