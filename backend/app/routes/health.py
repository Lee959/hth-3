from flask import Blueprint, current_app, jsonify
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db

health_bp = Blueprint("health", __name__)


@health_bp.get("/api/health")
def health():
    """Up, and able to reach the database? The frontend polls this to warn
    when workouts can't be saved (see ConnectionWarning.jsx)."""
    try:
        db.session.execute(text("SELECT 1"))
    except SQLAlchemyError as err:
        db.session.rollback()
        current_app.logger.warning("health check: database unreachable: %s", err)
        return jsonify({"status": "degraded", "database": "unreachable"}), 503
    return jsonify({"status": "ok", "database": "ok"})
