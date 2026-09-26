from datetime import datetime, timezone

from ..extensions import db


class VitalsReading(db.Model):
    """One Presage vitals sample for a session.

    Meant to become a TigerData/TimescaleDB hypertable partitioned on
    `recorded_at` (see backend/sql/create_hypertable.sql). Timescale requires
    every unique/primary-key constraint on a hypertable to include the
    partitioning column, so the primary key here is (id, recorded_at)
    instead of just `id`.
    """

    __tablename__ = "vitals_readings"

    id = db.Column(db.Integer, autoincrement=True, nullable=False)
    session_id = db.Column(db.Integer, db.ForeignKey("workout_sessions.id"), nullable=False)
    # Start of the video clip this reading was measured from (not when
    # Presage's answer came back, which can be ~30s later), and the clip's
    # length: the reading describes [recorded_at, recorded_at + window_sec].
    recorded_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    window_sec = db.Column(db.Float, nullable=True)
    heart_rate_bpm = db.Column(db.Float, nullable=True)
    breathing_rate_bpm = db.Column(db.Float, nullable=True)
    hrv_ms = db.Column(db.Float, nullable=True)
    source = db.Column(db.String(50), default="presage")

    __table_args__ = (
        db.PrimaryKeyConstraint("id", "recorded_at"),
        # Every read is "this session's readings in time order".
        db.Index("ix_vitals_readings_session_time", "session_id", "recorded_at"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "session_id": self.session_id,
            "recorded_at": self.recorded_at.isoformat() if self.recorded_at else None,
            "window_sec": self.window_sec,
            "heart_rate_bpm": self.heart_rate_bpm,
            "breathing_rate_bpm": self.breathing_rate_bpm,
            "hrv_ms": self.hrv_ms,
            "source": self.source,
        }
