"""The webpage <-> database connection, through the Flask API.

The frontend never talks to the database directly: its pages call the API
under /api (proxied by Vite in dev, see frontend/vite.config.js) and the API
reads and writes the database. These tests send the requests the pages send
(pages/WorkoutSession.jsx, hooks/useWorkoutHistory.js, useWorkoutSummary.js)
and check both directions: what the page sends is saved, and what is saved
comes back to the page in the shape it reads.

They run on conftest.py's in-memory SQLite. To also check the real database
in DATABASE_URL (read-only: one query and a table listing), run:

    RUN_LIVE_DB_TESTS=1 pytest tests/test_webpage_database_connection.py
"""
import itertools
import os
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, event, inspect, text

from app.config import _database_url
from app.extensions import db
from app.models import ExerciseSet, User, VitalsReading, WorkoutSession

# The Vite dev server (frontend/vite.config.js), allowed by the default CORS_ORIGINS.
WEBPAGE_ORIGIN = "http://localhost:5173"
TABLES = {"users", "workout_sessions", "exercise_sets", "rep_events", "vitals_readings"}


@pytest.fixture(autouse=True)
def numbered_vitals_readings():
    """SQLite can't autoincrement vitals_readings.id (part of a composite
    primary key, see conftest.create_all_tables), so saving a heart rate
    fails here though it works on Postgres. Number the rows in Python."""
    ids = itertools.count(1)

    def assign_id(mapper, connection, target):
        if target.id is None:
            target.id = next(ids)

    event.listen(VitalsReading, "before_insert", assign_id)
    yield
    event.remove(VitalsReading, "before_insert", assign_id)


def _from_webpage(client, method, path, status=200, **kwargs):
    """Sends a request as the browser does from the webpage (with its Origin)
    and checks the browser would let the page read the response."""
    resp = client.open(path, method=method, headers={"Origin": WEBPAGE_ORIGIN}, **kwargs)
    assert resp.status_code == status, resp.get_data(as_text=True)
    assert resp.headers.get("Access-Control-Allow-Origin") == WEBPAGE_ORIGIN
    return resp.get_json()


def test_database_answers_and_has_every_table(app):
    assert db.session.execute(text("SELECT 1")).scalar() == 1
    assert TABLES <= set(inspect(db.engine).get_table_names())


def test_webpage_origin_passes_cors_preflight(client):
    # What the browser asks before a cross-origin POST carrying the Auth0 token.
    resp = client.options(
        "/api/workouts/",
        headers={
            "Origin": WEBPAGE_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization, content-type",
        },
    )
    assert resp.headers["Access-Control-Allow-Origin"] == WEBPAGE_ORIGIN
    assert "POST" in resp.headers["Access-Control-Allow-Methods"]
    assert "authorization" in resp.headers["Access-Control-Allow-Headers"].lower()


def test_other_origins_are_refused(client):
    resp = client.get("/api/workouts/", headers={"Origin": "https://not-our-site.example"})
    assert "Access-Control-Allow-Origin" not in resp.headers


def test_workout_page_saves_to_database(app, client):
    """WorkoutSession.jsx: start a workout, save the live heart rate, save a
    set as it closes, end the workout. Each request lands in the database."""
    session_id = _from_webpage(client, "POST", "/api/workouts/", status=201)["id"]
    _from_webpage(
        client,
        "POST",
        f"/api/vitals/{session_id}/readings",
        status=201,
        json={"heart_rate_bpm": 96, "recorded_at": "2026-09-26T18:00:05.000Z", "window_sec": 5},
    )
    _from_webpage(
        client,
        "POST",
        f"/api/workouts/{session_id}/sets",
        status=201,
        json={
            "exercise_name": "squat",
            "reps": 12,
            "form_score": 88,
            "range_of_motion": 91,
            "symmetry": 95,
            "avg_rep_seconds": 2.4,
        },
    )
    _from_webpage(client, "POST", f"/api/workouts/{session_id}/end")

    db.session.expire_all()  # read from the database, not objects cached by the routes
    session = db.session.get(WorkoutSession, session_id)
    assert session.user.auth0_sub == app.config["DEV_USER_SUB"]
    assert session.status == "ended"
    assert session.ended_at is not None

    [reading] = session.vitals_readings
    assert (reading.heart_rate_bpm, reading.window_sec, reading.source) == (96, 5, "rppg")
    assert reading.recorded_at.isoformat().startswith("2026-09-26T18:00:05")

    [saved_set] = session.exercise_sets
    assert (saved_set.exercise_name, saved_set.reps) == ("squat", 12)
    assert (saved_set.form_score, saved_set.range_of_motion, saved_set.symmetry) == (88, 91, 95)
    assert saved_set.avg_rep_seconds == 2.4
    assert saved_set.muscle_groups == ["QUADS", "GLUTES", "HAMSTRINGS"]


def test_saved_workouts_reach_the_home_page(app, client):
    """useWorkoutHistory and useWorkoutSummary: rows already in the database
    come back with the fields the home page reads."""
    start = datetime(2026, 9, 26, 18, 0, tzinfo=timezone.utc)
    user = User(auth0_sub=app.config["DEV_USER_SUB"])
    db.session.add(user)
    db.session.flush()
    session = WorkoutSession(
        user_id=user.id,
        started_at=start,
        ended_at=start + timedelta(minutes=30),
        status="ended",
        duration_sec=30 * 60,
    )
    db.session.add(session)
    db.session.flush()
    db.session.add_all(
        [
            ExerciseSet(session_id=session.id, exercise_name="squat", reps=10, form_score=80),
            ExerciseSet(session_id=session.id, exercise_name="push_up", reps=5, form_score=90),
            VitalsReading(session_id=session.id, recorded_at=start + timedelta(minutes=1), heart_rate_bpm=100),
            VitalsReading(session_id=session.id, recorded_at=start + timedelta(minutes=2), heart_rate_bpm=120),
        ]
    )
    db.session.commit()
    session_id = session.id
    db.session.expire_all()

    [row] = _from_webpage(client, "GET", "/api/workouts/?limit=500")
    assert row["id"] == session_id
    assert row["started_at"].startswith("2026-09-26T18:00:00")
    assert row["total_reps"] == 15
    assert row["exercises"] == ["push_up", "squat"]

    summary = _from_webpage(client, "GET", "/api/workouts/summary")
    assert summary["total_workouts"] == 1
    assert summary["total_reps"] == 15
    assert summary["active_minutes"] == 30
    assert summary["avg_heart_rate_bpm"] == 110
    assert [(r["exercise"], r["reps"]) for r in summary["reps_by_exercise"]] == [("squat", 10), ("push_up", 5)]
    assert summary["latest_heart_rate"]["points"] == [{"t_sec": 60, "bpm": 100}, {"t_sec": 120, "bpm": 120}]


@pytest.mark.skipif(not os.getenv("RUN_LIVE_DB_TESTS"), reason="set RUN_LIVE_DB_TESTS=1 to check DATABASE_URL")
def test_real_database_is_reachable_and_migrated():
    """The database in DATABASE_URL (backend/.env) accepts connections and
    has every table; if not, run `flask db upgrade` (docs/SETUP.md)."""
    engine = create_engine(_database_url())
    try:
        with engine.connect() as conn:
            assert conn.execute(text("SELECT 1")).scalar() == 1
        assert TABLES <= set(inspect(engine).get_table_names())
    finally:
        engine.dispose()
