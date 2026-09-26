from flask import Blueprint, jsonify
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from ..database_log import describe, logger as database_log
from ..extensions import db

health_bp = Blueprint("health", __name__)


@health_bp.get("/api/health")
def health():
    """Up, and able to reach the database? For checking a setup (see
    docs/SETUP.md) or monitoring; failures also go to logs/database.log."""
    try:
        db.session.execute(text("SELECT 1"))
    except SQLAlchemyError as err:
        db.session.rollback()
        database_log.error("Health check: database unreachable: %s", describe(err))
        return jsonify({"status": "degraded", "database": "unreachable"}), 503
    return jsonify({"status": "ok", "database": "ok"})
