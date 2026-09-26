from datetime import datetime, timezone

from ..extensions import db
from ..services.effort import ZONES

# WHO adult BMI bands: (upper bound, label); the last band has no upper bound.
BMI_CATEGORIES = [(18.5, "underweight"), (25.0, "normal"), (30.0, "overweight"), (None, "obese")]
HEALTHY_BMI_RANGE = (18.5, 24.9)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    auth0_sub = db.Column(db.String(255), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), nullable=True)
    display_name = db.Column(db.String(255), nullable=True)
    # Body profile, metric units. Everything derived from these (BMI, max
    # heart rate, zones) is computed below rather than stored, so it can
    # never drift out of sync when the profile is edited.
    age = db.Column(db.Integer, nullable=True)
    weight_kg = db.Column(db.Float, nullable=True)
    height_cm = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    sessions = db.relationship("WorkoutSession", backref="user", lazy=True)

    @property
    def bmi(self):
        if not self.weight_kg or not self.height_cm:
            return None
        return round(self.weight_kg / (self.height_cm / 100) ** 2, 1)

    @property
    def bmi_category(self):
        bmi = self.bmi
        if bmi is None:
            return None
        return next(label for upper, label in BMI_CATEGORIES if upper is None or bmi < upper)

    @property
    def healthy_weight_range_kg(self):
        """Weights that put this height inside the WHO normal BMI band."""
        if not self.height_cm:
            return None
        h2 = (self.height_cm / 100) ** 2
        return [round(bmi * h2, 1) for bmi in HEALTHY_BMI_RANGE]

    @property
    def estimated_max_heart_rate(self):
        """Tanaka formula (208 - 0.7 x age); closer than 220 - age for adults."""
        return round(208 - 0.7 * self.age) if self.age else None

    @property
    def heart_rate_zones(self):
        """The five effort zones (services/effort.py) as bpm ranges for this user."""
        max_hr = self.estimated_max_heart_rate
        if max_hr is None:
            return None
        bounds = [lower for lower, _ in ZONES] + [1.0]
        return [
            {"zone": i + 1, "min_bpm": round(lo * max_hr), "max_bpm": round(hi * max_hr)}
            for i, (lo, hi) in enumerate(zip(bounds, bounds[1:]))
        ]

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "auth0_sub": self.auth0_sub,
            "email": self.email,
            "display_name": self.display_name,
            "age": self.age,
            "weight_kg": self.weight_kg,
            "height_cm": self.height_cm,
            "bmi": self.bmi,
            "bmi_category": self.bmi_category,
            "healthy_weight_range_kg": self.healthy_weight_range_kg,
            "estimated_max_heart_rate": self.estimated_max_heart_rate,
            "heart_rate_zones": self.heart_rate_zones,
        }
