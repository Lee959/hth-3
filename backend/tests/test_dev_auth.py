from app import create_app
from app.config import Config
from app.extensions import db


class NoAuth0Config(Config):
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    AUTH0_DOMAIN = ""
    AUTH0_AUDIENCE = ""
    DEV_USER_SUB = ""


def _client(config):
    app = create_app(config)
    with app.app_context():
        # Only the plain tables: SQLite can't build the hypertables' composite
        # autoincrement keys, and these routes don't touch them.
        tables = [db.metadata.tables[t] for t in ("users", "workout_sessions", "exercise_sets")]
        db.metadata.create_all(db.engine, tables=tables)
    return app.test_client()


def test_without_auth0_or_dev_user_protected_routes_refuse():
    resp = _client(NoAuth0Config).get("/api/workouts/")
    assert resp.status_code == 500


def test_dev_user_answers_without_a_token():
    class DevConfig(NoAuth0Config):
        DEV_USER_SUB = "demo|example-user"

    client = _client(DevConfig)
    resp = client.post("/api/workouts/", json={"started_at": "2026-09-26T18:00:00Z"})
    assert resp.status_code == 201
    history = client.get("/api/workouts/")
    assert history.status_code == 200
    assert [s["id"] for s in history.get_json()] == [resp.get_json()["id"]]
