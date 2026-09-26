from datetime import datetime, timedelta, timezone

import requests
from flask import Blueprint, current_app, jsonify, request

from .. import rppg_engine
from ..auth.decorators import requires_auth
from ..extensions import db
from ..models import VitalsReading
from ..services import presage_client
from ..timeutil import parse_timestamp
from .access import owned_session_or_404

vitals_bp = Blueprint("vitals", __name__)

# Clip length assumed when the client doesn't say (useVitalsUpload's default chunkMs).
DEFAULT_CLIP_SEC = 10.0


@vitals_bp.post("/<int:session_id>/chunks")
@requires_auth
def upload_chunk(session_id: int):
    """Accepts one recorded video chunk (see frontend useVitalsUpload hook),
    measures heart rate from it (locally with OpenCV rPPG, or via Presage
    when PRESAGE_API_KEY is set), and stores the resulting reading.

    Optional form fields `started_at` (ISO 8601 or epoch ms) and
    `duration_sec` say when the clip was filmed. Without them the clip is
    assumed to have just ended when the upload arrived."""
    received_at = datetime.now(timezone.utc)  # before measuring, which takes seconds
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

    file = request.files["chunk"]
    file_bytes = file.read()
    # Measuring takes seconds (Presage up to ~30s); give the database
    # connection back to the pool instead of holding it idle meanwhile.
    db.session.close()
    if current_app.config["PRESAGE_API_KEY"]:
        try:
            results = presage_client.analyze_video_chunk(file_bytes, content_type=file.mimetype)
        except (requests.RequestException, presage_client.PresageError, KeyError, ValueError) as err:
            return jsonify({"error": f"Presage request failed: {err}"}), 502
        measured = {
            "heart_rate_bpm": results.get("pulse_rate"),
            "breathing_rate_bpm": results.get("breathing_rate"),
            "hrv_ms": results.get("hrv"),
            "source": "presage",
        }
    else:
        # No Presage key: measure heart rate locally with OpenCV (rPPG).
        suffix = ".mp4" if "mp4" in (file.mimetype or "") else ".webm"
        try:
            estimate = rppg_engine.measure_heart_rate(file_bytes, suffix)
        except rppg_engine.NoPulseReading as err:
            return jsonify({"error": f"no heart rate measured: {err}"}), 422
        measured = {"heart_rate_bpm": estimate.heart_rate_bpm, "source": "rppg"}

    reading = VitalsReading(
        session_id=session_id,
        recorded_at=clip_started_at,
        window_sec=window_sec,
        **measured,
    )
    db.session.add(reading)
    db.session.commit()
    return jsonify(reading.to_dict()), 201


@vitals_bp.post("/<int:session_id>/readings")
@requires_auth
def add_reading(session_id: int):
    """Stores a heart rate the browser already measured (live camera rPPG,
    see frontend useLiveHeartRate). JSON: `heart_rate_bpm` (required), and
    optionally `recorded_at` (ISO 8601 or epoch ms, default now) and
    `window_sec` (the stretch of time the reading covers)."""
    owned_session_or_404(session_id)
    body = request.get_json(silent=True) or {}
    try:
        bpm = float(body["heart_rate_bpm"])
        recorded_at = parse_timestamp(body.get("recorded_at")) or datetime.now(timezone.utc)
        window_sec = float(body["window_sec"]) if body.get("window_sec") is not None else None
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "heart_rate_bpm must be a number; recorded_at ISO 8601 or epoch ms; window_sec a number"}), 400
    if not 30 <= bpm <= 250:
        return jsonify({"error": "heart_rate_bpm must be between 30 and 250"}), 400

    reading = VitalsReading(
        session_id=session_id,
        recorded_at=recorded_at,
        window_sec=window_sec,
        heart_rate_bpm=bpm,
        source="rppg",
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
