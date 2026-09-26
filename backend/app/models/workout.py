from datetime import datetime, timezone

from ..extensions import db


class WorkoutSession(db.Model):
    __tablename__ = "workout_sessions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    started_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    ended_at = db.Column(db.DateTime(timezone=True), nullable=True)

    exercise_sets = db.relationship("ExerciseSet", backref="session", lazy=True)
    vitals_readings = db.relationship("VitalsReading", backref="session", lazy=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
        }


class ExerciseSet(db.Model):
    __tablename__ = "exercise_sets"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("workout_sessions.id"), nullable=False)
    exercise_name = db.Column(db.String(120), nullable=False)
    muscle_groups = db.Column(db.JSON, default=list)
    reps = db.Column(db.Integer, default=0)
    form_score = db.Column(db.Float, nullable=True)
    # Movement-quality averages over the set's reps (see the frontend's
    # lib/repQuality.js for how each is scored): range of motion and
    # left/right symmetry as 0-100 percentages, tempo as seconds per rep.
    range_of_motion = db.Column(db.Float, nullable=True)
    symmetry = db.Column(db.Float, nullable=True)
    avg_rep_seconds = db.Column(db.Float, nullable=True)
    recorded_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "session_id": self.session_id,
            "exercise_name": self.exercise_name,
            "muscle_groups": self.muscle_groups,
            "reps": self.reps,
            "form_score": self.form_score,
            "range_of_motion": self.range_of_motion,
            "symmetry": self.symmetry,
            "avg_rep_seconds": self.avg_rep_seconds,
            "recorded_at": self.recorded_at.isoformat() if self.recorded_at else None,
        }
