from sqlalchemy.exc import OperationalError

from app import create_app
from app.config import Config
from app.extensions import db


class TestConfig(Config):
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    AUTH0_DOMAIN = "test.auth0.com"
    AUTH0_AUDIENCE = "test-audience"


def test_health_check():
    app = create_app(TestConfig)
    client = app.test_client()
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.get_json() == {"status": "ok", "database": "ok"}


def test_health_check_reports_unreachable_database(monkeypatch, log_dir):
    app = create_app(TestConfig)

    def unreachable(*args, **kwargs):
        raise OperationalError("SELECT 1", {}, Exception("No route to host"))

    with app.app_context():
        monkeypatch.setattr(db.session, "execute", unreachable)
        resp = app.test_client().get("/api/health")
    assert resp.status_code == 503
    assert resp.get_json()["database"] == "unreachable"
    assert "ERROR Health check: database unreachable: No route to host" in (log_dir / "database.log").read_text()
