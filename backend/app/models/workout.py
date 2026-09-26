from datetime import datetime, timezone

from ..extensions import db


class WorkoutSession(db.Model):
    __tablename__ = "workout_sessions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    started_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    ended_at = db.Column(db.DateTime(timezone=True), nullable=True)  # null while active
    status = db.Column(db.String(20), nullable=False, default="active")  # 'active' | 'ended'

    # Summary snapshot, computed once when the workout ends so the summary
    # page and history list are a single row read, and a past workout's
    # scores stay fixed even if the scoring formulas change later.
    duration_sec = db.Column(db.Integer, nullable=True)
    total_reps = db.Column(db.Integer, nullable=True)
    avg_heart_rate_bpm = db.Column(db.Float, nullable=True)
    max_heart_rate_bpm = db.Column(db.Float, nullable=True)
    zone_minutes = db.Column(db.JSON, nullable=True)  # minutes in HR zones 1-5
    form_score = db.Column(db.Float, nullable=True)
    effort_score = db.Column(db.Integer, nullable=True)

    exercise_sets = db.relationship("ExerciseSet", backref="session", lazy=True)
    vitals_readings = db.relationship("VitalsReading", backref="session", lazy=True)
    rep_events = db.relationship("RepEvent", backref="session", lazy=True)

    # History and summary both list one user's sessions by start time.
    __table_args__ = (db.Index("ix_workout_sessions_user_started", "user_id", "started_at"),)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "status": self.status,
            "duration_sec": self.duration_sec,
            "total_reps": self.total_reps,
            "avg_heart_rate_bpm": self.avg_heart_rate_bpm,
            "max_heart_rate_bpm": self.max_heart_rate_bpm,
            "zone_minutes": self.zone_minutes,
            "form_score": self.form_score,
            "effort_score": self.effort_score,
        }


class ExerciseSet(db.Model):
    __tablename__ = "exercise_sets"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("workout_sessions.id"), nullable=False, index=True)
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
    # When the set's first rep started and when it closed (the frontend's
    # tracker knows both); recorded_at is just when the row was written.
    started_at = db.Column(db.DateTime(timezone=True), nullable=True)
    ended_at = db.Column(db.DateTime(timezone=True), nullable=True)
    recorded_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    rep_events = db.relationship("RepEvent", backref="exercise_set", lazy=True)

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
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "recorded_at": self.recorded_at.isoformat() if self.recorded_at else None,
        }


class RepEvent(db.Model):
    """One scored rep (see the frontend's lib/repQuality.js scoreRep).

    A TimescaleDB hypertable partitioned on `recorded_at`, like
    VitalsReading, so the primary key has to include that column too.
    Reps are sent along with their set when it closes, so `set_id` is
    normally filled; it's nullable in case reps are ever streamed live.
    """

    __tablename__ = "rep_events"

    id = db.Column(db.Integer, autoincrement=True, nullable=False)
    recorded_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    session_id = db.Column(db.Integer, db.ForeignKey("workout_sessions.id"), nullable=False)
    set_id = db.Column(db.Integer, db.ForeignKey("exercise_sets.id"), nullable=True)
    exercise_name = db.Column(db.String(120), nullable=False)
    rep_number = db.Column(db.Integer, nullable=False)  # 1-based within its set
    range_of_motion = db.Column(db.Float, nullable=True)  # 0-100
    symmetry = db.Column(db.Float, nullable=True)  # 0-100
    tempo_score = db.Column(db.Float, nullable=True)  # 0-100; null when duration unknown
    rep_seconds = db.Column(db.Float, nullable=True)
    form_score = db.Column(db.Float, nullable=True)  # 0-100

    __table_args__ = (
        db.PrimaryKeyConstraint("id", "recorded_at"),
        db.Index("ix_rep_events_session_time", "session_id", "recorded_at"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "session_id": self.session_id,
            "set_id": self.set_id,
            "recorded_at": self.recorded_at.isoformat() if self.recorded_at else None,
            "exercise_name": self.exercise_name,
            "rep_number": self.rep_number,
            "range_of_motion": self.range_of_motion,
            "symmetry": self.symmetry,
            "tempo_score": self.tempo_score,
            "rep_seconds": self.rep_seconds,
            "form_score": self.form_score,
        }
