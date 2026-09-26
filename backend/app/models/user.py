from datetime import datetime, timezone

from ..extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    auth0_sub = db.Column(db.String(255), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), nullable=True)
    display_name = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    sessions = db.relationship("WorkoutSession", backref="user", lazy=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "auth0_sub": self.auth0_sub,
            "email": self.email,
            "display_name": self.display_name,
        }
