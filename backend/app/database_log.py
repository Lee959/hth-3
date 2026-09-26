"""Record of every time the database couldn't be reached, in
<LOG_DIR>/database.log (backend/logs/ by default).

Any request that fails because the database is down or the connection
dropped is logged there with its method and path, and answered with a 503
`{"error": "database unreachable"}` instead of a bare 500. The health
check logs its failures here too.
"""
import logging
import os
from logging.handlers import RotatingFileHandler

from flask import jsonify, request
from sqlalchemy.exc import InterfaceError, OperationalError

from .extensions import db

# "app.database_log": a child of Flask's app.logger, so each entry also
# shows in the server's console.
logger = logging.getLogger(__name__)

# Rotated at 1 MB, keeping the last five files, so an outage that lasts
# all night can't fill the disk.
MAX_BYTES = 1_000_000
BACKUP_COUNT = 5


def describe(err) -> str:
    """The driver's own message (e.g. "connection to server ... failed:
    timeout expired"), first line only, without SQLAlchemy's SQL and link."""
    message = str(getattr(err, "orig", None) or err).strip()
    return message.splitlines()[0] if message else type(err).__name__


def init_app(app):
    log_dir = app.config["LOG_DIR"]
    os.makedirs(log_dir, exist_ok=True)
    handler = RotatingFileHandler(
        os.path.join(log_dir, "database.log"),
        maxBytes=MAX_BYTES,
        backupCount=BACKUP_COUNT,
        encoding="utf-8",
        delay=True,  # no empty file until there's something to say
    )
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    # One app at a time (the dev reloader and the tests each build a fresh
    # one), so replace the last app's file handler rather than stacking.
    for old in logger.handlers[:]:
        logger.removeHandler(old)
        old.close()
    logger.addHandler(handler)
    logger.setLevel(logging.WARNING)
    app.logger  # sets up Flask's console handler, which entries propagate to

    def database_unreachable(err):
        db.session.rollback()
        logger.error("Database unreachable during %s %s: %s", request.method, request.path, describe(err))
        return jsonify({"error": "database unreachable"}), 503

    app.register_error_handler(OperationalError, database_unreachable)
    app.register_error_handler(InterfaceError, database_unreachable)
