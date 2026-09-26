"""Minimal joint-angle rep counter.

Mirrors the logic teams typically run client-side (JS) against MediaPipe
landmarks. Kept here too so the backend can re-validate rep counts from
spot-check frames, or so the whole pipeline can run server-side if a team
decides that's simpler than shipping WASM to the browser.
"""
import math
from dataclasses import dataclass


@dataclass
class RepCounter:
    down_angle_threshold: float = 90.0
    up_angle_threshold: float = 160.0
    state: str = "up"
    reps: int = 0

    def update(self, joint_angle_deg: float) -> int:
        if self.state == "up" and joint_angle_deg <= self.down_angle_threshold:
            self.state = "down"
        elif self.state == "down" and joint_angle_deg >= self.up_angle_threshold:
            self.state = "up"
            self.reps += 1
        return self.reps


def angle_between(a: tuple[float, float], b: tuple[float, float], c: tuple[float, float]) -> float:
    """Angle at point b, formed by segments b->a and b->c, in degrees."""
    ang = math.degrees(
        math.atan2(c[1] - b[1], c[0] - b[0]) - math.atan2(a[1] - b[1], a[0] - b[0])
    )
    ang = abs(ang)
    return 360 - ang if ang > 180 else ang
