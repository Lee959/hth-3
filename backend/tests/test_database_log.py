from app import create_app
from app.config import Config


class UnreachableDatabaseConfig(Config):
    # Nothing listens on port 1, so every connection is refused straight away.
    SQLALCHEMY_DATABASE_URI = "postgresql://nobody@127.0.0.1:1/nothing?connect_timeout=2"
    AUTH0_DOMAIN = ""
    AUTH0_AUDIENCE = ""
    DEV_USER_SUB = "demo|example-user"


def test_requests_that_cannot_reach_the_database_are_logged(log_dir):
    client = create_app(UnreachableDatabaseConfig).test_client()

    resp = client.get("/api/workouts/")

    assert resp.status_code == 503
    assert resp.get_json() == {"error": "database unreachable"}
    entries = (log_dir / "database.log").read_text().splitlines()
    assert len(entries) == 1
    assert "ERROR Database unreachable during GET /api/workouts/: " in entries[0]
    assert "Connection refused" in entries[0]


def test_nothing_is_logged_while_the_database_is_fine(client, log_dir):
    assert client.get("/api/workouts/").status_code == 200
    assert not (log_dir / "database.log").exists()
