import pytest

from app import create_app
from app.config import Config
from app.extensions import db


class SqliteDevConfig(Config):
    """In-memory SQLite, no Auth0: requests act as the demo user."""

    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    AUTH0_DOMAIN = ""
    AUTH0_AUDIENCE = ""
    DEV_USER_SUB = "demo|example-user"
    PRESAGE_API_KEY = ""


def create_all_tables():
    """db.create_all() for SQLite, which can't autoincrement the hypertables'
    composite (id, recorded_at) keys, so those two are built without it."""
    ids = [db.metadata.tables[t].c.id for t in ("vitals_readings", "rep_events")]
    for col in ids:
        col.autoincrement = False
    try:
        db.create_all()
    finally:
        for col in ids:
            col.autoincrement = True


@pytest.fixture
def app():
    app = create_app(SqliteDevConfig)
    with app.app_context():
        create_all_tables()
        yield app


@pytest.fixture
def client(app):
    return app.test_client()
