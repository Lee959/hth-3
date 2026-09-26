from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from ..auth.decorators import requires_auth
from ..extensions import db
from ..models import ExerciseSet, User, WorkoutSession
from ..pose_engine.muscle_map import muscles_for

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


@workouts_bp.post("/")
@requires_auth
def start_session():
    user = _get_or_create_user()
    session = WorkoutSession(user_id=user.id)
    db.session.add(session)
    db.session.commit()
    return jsonify(session.to_dict()), 201


@workouts_bp.post("/<int:session_id>/end")
@requires_auth
def end_session(session_id: int):
    session = WorkoutSession.query.get_or_404(session_id)
    session.ended_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(session.to_dict())


@workouts_bp.post("/<int:session_id>/sets")
@requires_auth
def log_set(session_id: int):
    WorkoutSession.query.get_or_404(session_id)
    body = request.get_json(force=True) or {}
    exercise_name = body.get("exercise_name", "")

    exercise_set = ExerciseSet(
        session_id=session_id,
        exercise_name=exercise_name,
        muscle_groups=muscles_for(exercise_name),
        reps=body.get("reps", 0),
        form_score=body.get("form_score"),
    )
    db.session.add(exercise_set)
    db.session.commit()
    return jsonify(exercise_set.to_dict()), 201


@workouts_bp.get("/<int:session_id>")
@requires_auth
def get_session(session_id: int):
    session = WorkoutSession.query.get_or_404(session_id)
    return jsonify(
        {
            **session.to_dict(),
            "exercise_sets": [s.to_dict() for s in session.exercise_sets],
        }
    )
