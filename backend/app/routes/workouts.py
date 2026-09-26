from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request
from sqlalchemy.orm import selectinload

from ..auth.decorators import requires_auth
from ..extensions import db
from ..models import ExerciseSet, RepEvent, User, VitalsReading, WorkoutSession
from ..pose_engine.muscle_map import muscles_for
from ..services import effort
from ..timeutil import parse_timestamp

workouts_bp = Blueprint("workouts", __name__)


def _get_or_create_user() -> User:
    sub = g.current_user_sub
    user = User.query.filter_by(auth0_sub=sub).first()
    if user is None:
        claims = g.current_user_claims
        user = User(auth0_sub=sub, email=claims.get("email"), display_name=claims.get("name"))
        db.session.add(user)
        db.session.commit()
    return user


MAX_HISTORY_PAGE = 500


@workouts_bp.get("/")
@requires_auth
def list_sessions():
    """The current user's workout history, newest first, each with a small
    summary (total reps, exercises done). Pages through every past workout
    with `?limit=` (default 50, max 500) and `?offset=`; the total number of
    workouts is in the `X-Total-Count` response header."""
    limit = min(max(request.args.get("limit", 50, type=int), 1), MAX_HISTORY_PAGE)
    offset = max(request.args.get("offset", 0, type=int), 0)

    user = User.query.filter_by(auth0_sub=g.current_user_sub).first()
    if user is None:
        return jsonify([]), 200, {"X-Total-Count": "0"}

    query = WorkoutSession.query.filter_by(user_id=user.id)
    total = query.count()
    sessions = (
        query.options(selectinload(WorkoutSession.exercise_sets))
        .order_by(WorkoutSession.started_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    rows = [
        {
            **s.to_dict(),
            "total_reps": sum(x.reps or 0 for x in s.exercise_sets),
            "exercises": sorted({x.exercise_name for x in s.exercise_sets if x.exercise_name}),
        }
        for s in sessions
    ]
    return jsonify(rows), 200, {"X-Total-Count": str(total)}


def _weighted_mean(pairs):
    """Mean of (value, weight) pairs, skipping missing values; None if empty."""
    present = [(v, w) for v, w in pairs if v is not None and w]
    total = sum(w for _, w in present)
    return round(sum(v * w for v, w in present) / total, 1) if total else None


def _iso(dt):
    return dt.isoformat() if dt else None


@workouts_bp.get("/summary")
@requires_auth
def summary():
    """All-time totals for the home page summary: workout count, reps,
    active minutes, per-exercise reps and form, movement quality, average
    heart rate, the latest session's heart-rate trace, and form/effort
    scores per session for trend lines."""
    user = User.query.filter_by(auth0_sub=g.current_user_sub).first()
    sessions = (
        WorkoutSession.query.filter_by(user_id=user.id)
        .options(selectinload(WorkoutSession.exercise_sets))
        .order_by(WorkoutSession.started_at)
        .all()
        if user
        else []
    )

    all_sets = [x for s in sessions for x in s.exercise_sets]
    active_seconds = sum(
        (s.ended_at - s.started_at).total_seconds() for s in sessions if s.started_at and s.ended_at
    )

    by_exercise: dict = {}
    for x in all_sets:
        if x.exercise_name:
            by_exercise.setdefault(x.exercise_name, []).append(x)
    exercise_rows = sorted(
        (
            {
                "exercise": name,
                "reps": sum(x.reps or 0 for x in sets),
                "form_score": _weighted_mean((x.form_score, x.reps) for x in sets),
                "range_of_motion": _weighted_mean((x.range_of_motion, x.reps) for x in sets),
                "symmetry": _weighted_mean((x.symmetry, x.reps) for x in sets),
                "avg_rep_seconds": _weighted_mean((x.avg_rep_seconds, x.reps) for x in sets),
            }
            for name, sets in by_exercise.items()
        ),
        key=lambda row: row["reps"],
        reverse=True,
    )

    # One query for every heart-rate reading, grouped per session as
    # (seconds into the workout, bpm) points.
    traces: dict = {s.id: [] for s in sessions}
    started = {s.id: s.started_at for s in sessions}
    if sessions:
        readings = (
            VitalsReading.query.filter(VitalsReading.session_id.in_(list(traces)))
            .order_by(VitalsReading.recorded_at)
            .all()
        )
        for r in readings:
            if r.heart_rate_bpm is not None and started[r.session_id]:
                t = (r.recorded_at - started[r.session_id]).total_seconds()
                traces[r.session_id].append((t, r.heart_rate_bpm))
    all_bpm = [bpm for points in traces.values() for _, bpm in points]
    max_hr = max([effort.DEFAULT_MAX_HR, *all_bpm])

    form_trend, effort_trend = [], []
    latest_effort = None
    latest_trace = None
    for s in sessions:
        session_reps = sum(x.reps or 0 for x in s.exercise_sets)
        form = _weighted_mean((x.form_score, x.reps) for x in s.exercise_sets)
        if form is not None:
            form_trend.append({"session_id": s.id, "started_at": _iso(s.started_at), "score": form})
        points = traces[s.id]
        if points or session_reps:
            minutes = effort.zone_minutes(points, max_hr)
            score = effort.effort_score(minutes, session_reps)
            effort_trend.append({"session_id": s.id, "started_at": _iso(s.started_at), "score": score})
            latest_effort = {
                "session_id": s.id,
                "started_at": _iso(s.started_at),
                "score": score,
                "zone_minutes": [round(m, 1) for m in minutes],
                "has_heart_rate": bool(points),
            }
        if points:
            latest_trace = {
                "session_id": s.id,
                "started_at": _iso(s.started_at),
                "points": [{"t_sec": t, "bpm": bpm} for t, bpm in points],
            }

    return jsonify(
        {
            "total_workouts": len(sessions),
            "total_reps": sum(row["reps"] for row in exercise_rows),
            "active_minutes": round(active_seconds / 60),
            "reps_by_exercise": exercise_rows,
            "avg_heart_rate_bpm": round(sum(all_bpm) / len(all_bpm)) if all_bpm else None,
            "latest_heart_rate": latest_trace,
            "form": {
                "score": _weighted_mean((x.form_score, x.reps) for x in all_sets),
                "trend": form_trend[-10:],
            },
            "movement": {
                "range_of_motion": _weighted_mean((x.range_of_motion, x.reps) for x in all_sets),
                "symmetry": _weighted_mean((x.symmetry, x.reps) for x in all_sets),
                "avg_rep_seconds": _weighted_mean((x.avg_rep_seconds, x.reps) for x in all_sets),
            },
            "effort": {
                "latest": latest_effort,
                "average": round(sum(e["score"] for e in effort_trend) / len(effort_trend))
                if effort_trend
                else None,
                "trend": effort_trend[-10:],
                "max_heart_rate": max_hr,
            },
        }
    )


def _client_time(field: str):
    """Optional client-side timestamp from the JSON body (the moment the
    user pressed Start/End); None if not sent. Raises ValueError if bad."""
    body = request.get_json(silent=True) or {}
    return parse_timestamp(body.get(field))


@workouts_bp.post("/")
@requires_auth
def start_session():
    """Starts a workout. Optional body: {"started_at": ISO 8601 | epoch ms};
    defaults to now."""
    try:
        started_at = _client_time("started_at") or datetime.now(timezone.utc)
    except ValueError:
        return jsonify({"error": "started_at must be ISO 8601 or epoch ms"}), 400
    user = _get_or_create_user()
    session = WorkoutSession(user_id=user.id, started_at=started_at)
    db.session.add(session)
    db.session.commit()
    return jsonify(session.to_dict()), 201


@workouts_bp.post("/<int:session_id>/end")
@requires_auth
def end_session(session_id: int):
    """Ends a workout and records its duration. Optional body:
    {"ended_at": ISO 8601 | epoch ms}; defaults to now. Ending an
    already-ended workout returns it unchanged."""
    session = WorkoutSession.query.get_or_404(session_id)
    if session.status == "ended":
        return jsonify(session.to_dict())
    try:
        ended_at = _client_time("ended_at") or datetime.now(timezone.utc)
    except ValueError:
        return jsonify({"error": "ended_at must be ISO 8601 or epoch ms"}), 400
    session.ended_at = max(ended_at, session.started_at)
    session.duration_sec = round((session.ended_at - session.started_at).total_seconds())
    session.status = "ended"
    db.session.commit()
    return jsonify(session.to_dict())


@workouts_bp.post("/<int:session_id>/sets")
@requires_auth
def log_set(session_id: int):
    """Logs one completed set, plus (optionally) its individually scored reps
    as `rep_events`: a list of {recorded_at, range_of_motion, symmetry,
    tempo_score, rep_seconds, form_score}, in rep order."""
    WorkoutSession.query.get_or_404(session_id)
    body = request.get_json(force=True) or {}
    exercise_name = body.get("exercise_name", "")

    try:
        started_at = parse_timestamp(body.get("started_at"))
        ended_at = parse_timestamp(body.get("ended_at"))
        reps_in = [(parse_timestamp(rep.get("recorded_at")), rep) for rep in body.get("rep_events") or []]
    except (ValueError, AttributeError):
        return jsonify({"error": "timestamps must be ISO 8601 or epoch ms; rep_events must be objects"}), 400

    exercise_set = ExerciseSet(
        session_id=session_id,
        exercise_name=exercise_name,
        muscle_groups=muscles_for(exercise_name),
        reps=body.get("reps", 0),
        form_score=body.get("form_score"),
        range_of_motion=body.get("range_of_motion"),
        symmetry=body.get("symmetry"),
        avg_rep_seconds=body.get("avg_rep_seconds"),
        started_at=started_at,
        ended_at=ended_at,
    )
    db.session.add(exercise_set)
    db.session.flush()  # assigns exercise_set.id for the reps below

    fallback_time = ended_at or datetime.now(timezone.utc)
    for number, (recorded_at, rep) in enumerate(reps_in, start=1):
        db.session.add(
            RepEvent(
                session_id=session_id,
                set_id=exercise_set.id,
                exercise_name=exercise_name,
                rep_number=number,
                recorded_at=recorded_at or fallback_time,
                range_of_motion=rep.get("range_of_motion"),
                symmetry=rep.get("symmetry"),
                tempo_score=rep.get("tempo_score"),
                rep_seconds=rep.get("rep_seconds"),
                form_score=rep.get("form_score"),
            )
        )
    db.session.commit()
    return jsonify(exercise_set.to_dict()), 201


@workouts_bp.get("/<int:session_id>")
@requires_auth
def get_session(session_id: int):
    """One workout in full, for its summary / history detail view: the
    session (times, duration, summary scores), its sets, its heart-rate
    readings and its individual reps, each in time order."""
    session = WorkoutSession.query.get_or_404(session_id)
    sets = ExerciseSet.query.filter_by(session_id=session_id).order_by(ExerciseSet.recorded_at).all()
    vitals = (
        VitalsReading.query.filter_by(session_id=session_id).order_by(VitalsReading.recorded_at).all()
    )
    reps = RepEvent.query.filter_by(session_id=session_id).order_by(RepEvent.recorded_at).all()
    return jsonify(
        {
            **session.to_dict(),
            "exercise_sets": [s.to_dict() for s in sets],
            "vitals": [v.to_dict() for v in vitals],
            "rep_events": [r.to_dict() for r in reps],
        }
    )
