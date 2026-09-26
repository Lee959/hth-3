import io
from datetime import datetime, timezone

import pytest

from app.extensions import db
from app.models import ExerciseSet, RepEvent, User, VitalsReading, WorkoutSession
from app.services import effort


def _start(client, when="2026-09-26T18:00:00Z"):
    resp = client.post("/api/workouts/", json={"started_at": when})
    assert resp.status_code == 201
    return resp.get_json()["id"]


def _log_set(client, session_id, **extra):
    return client.post(f"/api/workouts/{session_id}/sets", json={"exercise_name": "squat", "reps": 10, **extra})


def test_other_users_workouts_are_404(client):
    other = User(auth0_sub="auth0|someone-else")
    db.session.add(other)
    db.session.flush()
    theirs = WorkoutSession(user_id=other.id, started_at=datetime(2026, 9, 26, tzinfo=timezone.utc))
    db.session.add(theirs)
    db.session.commit()
    sid = theirs.id

    assert client.get(f"/api/workouts/{sid}").status_code == 404
    assert client.post(f"/api/workouts/{sid}/end").status_code == 404
    assert _log_set(client, sid).status_code == 404
    assert client.get(f"/api/vitals/{sid}").status_code == 404
    assert client.delete(f"/api/workouts/{sid}").status_code == 404
    db.session.expire_all()
    assert db.session.get(WorkoutSession, sid).status == "active"


def test_starting_a_workout_closes_abandoned_ones(client):
    first = _start(client, "2026-09-26T18:00:00Z")
    _log_set(client, first, started_at="2026-09-26T18:05:00Z", ended_at="2026-09-26T18:06:00Z")
    empty = _start(client, "2026-09-26T19:00:00Z")  # closes `first` at its last set
    third = _start(client, "2026-09-26T20:00:00Z")  # deletes `empty`: nothing was recorded

    db.session.expire_all()
    closed = db.session.get(WorkoutSession, first)
    assert closed.status == "ended"
    assert closed.duration_sec == 6 * 60
    assert db.session.get(WorkoutSession, empty) is None
    assert db.session.get(WorkoutSession, third).status == "active"


def test_history_and_summary_skip_workouts_without_sets(client):
    done = _start(client, "2026-09-26T18:00:00Z")
    _log_set(client, done)
    client.post(f"/api/workouts/{done}/end", json={"ended_at": "2026-09-26T18:30:00Z"})
    _start(client, "2026-09-26T19:00:00Z")  # opened, nothing logged yet

    history = client.get("/api/workouts/")
    assert [s["id"] for s in history.get_json()] == [done]
    assert history.headers["X-Total-Count"] == "1"

    summary = client.get("/api/workouts/summary").get_json()
    assert summary["total_workouts"] == 1
    assert summary["total_reps"] == 10
    assert summary["active_minutes"] == 30


def _add_heart_rate(session_id, *readings):
    """Stores (ISO time, bpm) readings directly: SQLite can't autoincrement
    the hypertable's composite key, so each gets an explicit id."""
    for time, bpm in readings:
        reading_id = (db.session.query(db.func.max(VitalsReading.id)).scalar() or 0) + 1
        db.session.add(
            VitalsReading(
                id=reading_id,
                session_id=session_id,
                recorded_at=datetime.fromisoformat(time),
                heart_rate_bpm=bpm,
                source="rppg",
            )
        )
    db.session.commit()


def test_workout_detail_includes_its_effort_score(client):
    sid = _start(client, "2026-09-26T18:00:00Z")
    _log_set(client, sid)
    client.post(f"/api/workouts/{sid}/end", json={"ended_at": "2026-09-26T18:20:00Z"})
    # 150 bpm is 79% of the default 190 max: zone 3, for 20 minutes.
    _add_heart_rate(
        sid,
        ("2026-09-26T18:00:00+00:00", 150),
        ("2026-09-26T18:10:00+00:00", 150),
        ("2026-09-26T18:20:00+00:00", 100),
    )

    detail = client.get(f"/api/workouts/{sid}").get_json()
    assert detail["effort"] == {
        "score": effort.effort_score([0, 0, 20, 0, 0], 10),
        "zone_minutes": [0, 0, 20.0, 0, 0],
        "has_heart_rate": True,
        "max_heart_rate": 190,
    }
    # The home page summary scores the same workout the same way.
    summary = client.get("/api/workouts/summary").get_json()
    assert summary["effort"]["latest"]["score"] == detail["effort"]["score"]


def test_deleting_a_workout_removes_it_and_everything_in_it(client):
    kept = _start(client, "2026-09-25T18:00:00Z")
    _log_set(client, kept)
    client.post(f"/api/workouts/{kept}/end", json={"ended_at": "2026-09-25T18:30:00Z"})

    sid = _start(client, "2026-09-26T18:00:00Z")
    set_id = _log_set(client, sid).get_json()["id"]
    client.post(f"/api/workouts/{sid}/end", json={"ended_at": "2026-09-26T18:30:00Z"})
    _add_heart_rate(sid, ("2026-09-26T18:05:00+00:00", 120))
    db.session.add(
        RepEvent(
            id=1,
            session_id=sid,
            set_id=set_id,
            exercise_name="squat",
            rep_number=1,
            recorded_at=datetime(2026, 9, 26, 18, 5, tzinfo=timezone.utc),
        )
    )
    db.session.commit()

    assert client.delete(f"/api/workouts/{sid}").status_code == 204

    assert client.get(f"/api/workouts/{sid}").status_code == 404
    assert client.delete(f"/api/workouts/{sid}").status_code == 404
    assert [s["id"] for s in client.get("/api/workouts/").get_json()] == [kept]
    for model in (ExerciseSet, RepEvent, VitalsReading):
        assert model.query.filter_by(session_id=sid).count() == 0
    assert ExerciseSet.query.filter_by(session_id=kept).count() == 1


@pytest.mark.parametrize(
    "body, field",
    [
        ({"reps": 3}, "exercise_name"),
        ({"exercise_name": "squat", "reps": "abc"}, "reps"),
        ({"exercise_name": "squat", "reps": -1}, "reps"),
        ({"exercise_name": "squat", "form_score": "high"}, "form_score"),
        ({"exercise_name": "squat", "started_at": "yesterday"}, "started_at"),
        ({"exercise_name": "squat", "rep_events": [1, 2]}, "rep_events"),
        (["not", "an", "object"], "JSON object"),
    ],
)
def test_bad_set_input_is_400(client, body, field):
    sid = _start(client)
    resp = client.post(f"/api/workouts/{sid}/sets", json=body)
    assert resp.status_code == 400
    assert field in resp.get_json()["error"]


def test_vitals_upload_without_presage_key_measures_locally(client):
    sid = _start(client)
    resp = client.post(
        f"/api/vitals/{sid}/chunks",
        data={"chunk": (io.BytesIO(b"fake"), "chunk.webm")},
        content_type="multipart/form-data",
    )
    # Not a real video, so the local rPPG engine can't measure anything.
    assert resp.status_code == 422
    assert "no heart rate measured" in resp.get_json()["error"]


@pytest.mark.parametrize(
    "body",
    [{}, {"heart_rate_bpm": "fast"}, {"heart_rate_bpm": 400}, {"heart_rate_bpm": 80, "recorded_at": "yesterday"}],
)
def test_live_heart_rate_reading_is_validated(client, body):
    sid = _start(client)
    resp = client.post(f"/api/vitals/{sid}/readings", json=body)
    assert resp.status_code == 400
    assert "heart_rate_bpm" in resp.get_json()["error"]


def test_live_heart_rate_reading_for_someone_elses_workout_is_404(client):
    other = User(auth0_sub="auth0|someone-else")
    db.session.add(other)
    db.session.flush()
    theirs = WorkoutSession(user_id=other.id, started_at=datetime(2026, 9, 26, tzinfo=timezone.utc))
    db.session.add(theirs)
    db.session.commit()
    assert client.post(f"/api/vitals/{theirs.id}/readings", json={"heart_rate_bpm": 80}).status_code == 404
