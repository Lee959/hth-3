from flask import Blueprint, jsonify, request

from ..auth.decorators import requires_auth
from ..extensions import db
from ..models import VitalsReading, WorkoutSession
from ..services import presage_client

vitals_bp = Blueprint("vitals", __name__)


@vitals_bp.post("/<int:session_id>/chunks")
@requires_auth
def upload_chunk(session_id: int):
    """Accepts one recorded video chunk (see frontend useVitalsUpload hook),
    forwards it to Presage, and stores the resulting reading."""
    WorkoutSession.query.get_or_404(session_id)

    if "chunk" not in request.files:
        return jsonify({"error": "multipart field 'chunk' is required"}), 400

    file = request.files["chunk"]
    results = presage_client.analyze_video_chunk(file.read(), content_type=file.mimetype)

    reading = VitalsReading(
        session_id=session_id,
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
