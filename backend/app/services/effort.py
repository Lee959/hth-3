"""Effort score: one 0-100 number per workout, so sessions of different
lengths and styles can be compared.

Modeled on heart-rate-zone effort scores like Peloton's Strive Score and
WHOOP's Strain: minutes in each of five zones (by % of max heart rate) are
weighted by zone, reps add a little on top so a workout without heart-rate
data still registers, and the total is squashed onto 0-100 with
diminishing returns (going from 90 to 100 takes far more work than 10 to
20).

Max heart rate is the higher of DEFAULT_MAX_HR (a population-typical value;
the app doesn't know anyone's age) and the highest reading the user has
ever recorded — the same "adjust upward when exceeded" approach WHOOP uses.
"""
import math

DEFAULT_MAX_HR = 190

# (lower bound as a fraction of max HR, points per minute), zones 1-5.
ZONES = [(0.5, 1), (0.6, 2), (0.7, 3), (0.8, 4), (0.9, 5)]

POINTS_PER_REP = 0.3

# Points at which the score reaches ~63/100; sets how fast it saturates.
# ~20 min in zone 3 lands around 50, ~30 min in zone 4 around 80.
SCALE = 80


def zone_of(bpm: float, max_hr: float):
    """Zone number 1-5 for a reading, or None below zone 1."""
    fraction = bpm / max_hr
    zone = None
    for number, (lower, _) in enumerate(ZONES, start=1):
        if fraction >= lower:
            zone = number
    return zone


def zone_minutes(points, max_hr: float) -> list:
    """Minutes spent in each zone, from (seconds_into_workout, bpm) points
    sorted by time. Each reading's zone holds until the next reading."""
    minutes = [0.0] * len(ZONES)
    for (t0, bpm), (t1, _) in zip(points, points[1:]):
        zone = zone_of(bpm, max_hr)
        if zone is not None and t1 > t0:
            minutes[zone - 1] += (t1 - t0) / 60
    return minutes


def effort_score(minutes_per_zone, reps: int) -> int:
    points = sum(m * weight for m, (_, weight) in zip(minutes_per_zone, ZONES))
    points += (reps or 0) * POINTS_PER_REP
    return round(100 * (1 - math.exp(-points / SCALE)))
