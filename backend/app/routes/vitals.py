from datetime import datetime, timedelta, timezone

import requests
from flask import Blueprint, current_app, jsonify, request

from ..auth.decorators import requires_auth
from ..extensions import db
from ..models import VitalsReading
from ..services import presage_client
from ..timeutil import parse_timestamp
from .access import owned_session_or_404

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
    owned_session_or_404(session_id)

    if "chunk" not in request.files:
        return jsonify({"error": "multipart field 'chunk' is required"}), 400

    try:
        window_sec = float(request.form.get("duration_sec") or DEFAULT_CLIP_SEC)
        clip_started_at = parse_timestamp(request.form.get("started_at"))
    except ValueError:
        return jsonify({"error": "started_at must be ISO 8601 or epoch ms; duration_sec a number"}), 400
    if clip_started_at is None:
        clip_started_at = received_at - timedelta(seconds=window_sec)

    if not current_app.config["PRESAGE_API_KEY"]:
        return jsonify({"error": "Presage isn't configured (PRESAGE_API_KEY), so no heart rate was measured"}), 503

    file = request.files["chunk"]
    file_bytes = file.read()
    # Presage can take ~30s; give the database connection back to the pool
    # instead of holding it (idle, mid-transaction) while waiting.
    db.session.close()
    try:
        results = presage_client.analyze_video_chunk(file_bytes, content_type=file.mimetype)
    except (requests.RequestException, presage_client.PresageError, KeyError, ValueError) as err:
        return jsonify({"error": f"Presage request failed: {err}"}), 502

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
    owned_session_or_404(session_id)
    readings = (
        VitalsReading.query.filter_by(session_id=session_id)
        .order_by(VitalsReading.recorded_at.desc())
        .limit(50)
        .all()
    )
    return jsonify([r.to_dict() for r in readings])
