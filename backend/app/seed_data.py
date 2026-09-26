"""Made-up but realistic workouts for the demo user, so the frontend has
real database rows to show before anyone records an actual workout.

Reps are scored with a port of the frontend's lib/repQuality.js scoreRep
(same weights and tempo bands), sets carry the averages of their reps like
summarizeReps, and heart rate is simulated every 20 seconds (one reading
per camera clip), climbing during sets and recovering during rest. Form
slowly improves across the weeks so the trend lines have a story.
Vitals rows are tagged source='seed' to tell them apart from Presage.
"""
import random
from datetime import datetime, timedelta, timezone

from .extensions import db
from .models import ExerciseSet, RepEvent, VitalsReading, WorkoutSession
from .pose_engine.muscle_map import muscles_for

CLIP_SEC = 20

# Mirrors REP_PROFILES / WEIGHTS in frontend/src/lib/repQuality.js.
TEMPO_BANDS = {
    "squat": (1.5, 4),
    "bicep_curl": (1.5, 4),
    "push_up": (1.2, 4),
    "jumping_jack": (0.5, 1.6),
    "crunch": (1, 3),
}
WEIGHTS = {"rom": 0.5, "symmetry": 0.3, "tempo": 0.2}

# Per exercise: typical rep count range, seconds per rep, baseline range of
# motion and symmetry, and how hard it pushes heart rate (fraction of max).
EXERCISES = {
    "squat": {"reps": (10, 15), "sec": 2.4, "rom": 80, "sym": 88, "hr": 0.78},
    "push_up": {"reps": (8, 14), "sec": 1.9, "rom": 70, "sym": 84, "hr": 0.76},
    "bicep_curl": {"reps": (10, 12), "sec": 2.6, "rom": 84, "sym": 86, "hr": 0.66},
    "jumping_jack": {"reps": (25, 40), "sec": 0.9, "rom": 78, "sym": 91, "hr": 0.86},
    "crunch": {"reps": (12, 20), "sec": 1.8, "rom": 68, "sym": 85, "hr": 0.64},
}

# Days ago for each workout (oldest first): roughly every other day for
# four weeks, with a couple of gaps, ending yesterday.
WORKOUT_DAYS_AGO = [27, 25, 24, 22, 20, 18, 17, 15, 13, 11, 10, 8, 6, 4, 3, 1]


def _clamp(v, lo=0.0, hi=100.0):
    return max(lo, min(hi, v))


def score_rep(exercise, rom, symmetry, seconds):
    """Python port of scoreRep: tempo is left out when duration is unknown."""
    tempo = None
    if seconds is not None:
        fast, slow = TEMPO_BANDS[exercise]
        if seconds < fast:
            tempo = _clamp(seconds / fast * 100)
        elif seconds > slow:
            tempo = _clamp(slow / seconds * 100)
        else:
            tempo = 100.0
    if tempo is None:
        form = (WEIGHTS["rom"] * rom + WEIGHTS["symmetry"] * symmetry) / (WEIGHTS["rom"] + WEIGHTS["symmetry"])
    else:
        form = WEIGHTS["rom"] * rom + WEIGHTS["symmetry"] * symmetry + WEIGHTS["tempo"] * tempo
    return tempo, form


def _mean(values):
    present = [v for v in values if v is not None]
    return round(sum(present) / len(present), 1) if present else None


def _plan_workout(rng, progress):
    """Exercise/set plan for one workout: 3 exercises, 1-2 sets each."""
    exercises = rng.sample(list(EXERCISES), 3)
    plan = []
    for name in exercises:
        lo, hi = EXERCISES[name]["reps"]
        for _ in range(rng.choice([1, 2, 2])):
            # Rep counts creep up as the weeks go by.
            reps = round(lo + (hi - lo) * _clamp(progress + rng.uniform(-0.3, 0.3), 0, 1))
            plan.append((name, reps))
    return plan


def _make_set(rng, session, exercise, reps, start, progress):
    """One set and its reps, starting at `start`. Returns (set, reps, end)."""
    profile = EXERCISES[exercise]
    fast, slow = TEMPO_BANDS[exercise]
    skill = 8 * progress  # up to +8 points of ROM/symmetry by the last week
    rep_rows = []
    t = start
    for n in range(1, reps + 1):
        fatigue = 6 * (n - 1) / max(reps - 1, 1)  # ROM sags a little late in the set
        seconds = rng.gauss(profile["sec"], profile["sec"] * 0.15)
        if rng.random() < 0.08:  # the odd rushed rep
            seconds = fast * rng.uniform(0.6, 0.95)
        seconds = max(0.4, min(seconds, slow * 1.3))
        t += timedelta(seconds=seconds)
        rom = _clamp(rng.gauss(profile["rom"] + skill - fatigue, 4))
        symmetry = _clamp(rng.gauss(profile["sym"] + skill / 2, 3))
        # The tracker can't time the first rep of a set (no previous rep).
        rep_seconds = None if n == 1 else round(seconds, 2)
        tempo, form = score_rep(exercise, rom, symmetry, rep_seconds)
        rep_rows.append(
            RepEvent(
                session_id=session.id,
                exercise_name=exercise,
                rep_number=n,
                recorded_at=t,
                range_of_motion=round(rom, 1),
                symmetry=round(symmetry, 1),
                tempo_score=None if tempo is None else round(tempo, 1),
                rep_seconds=rep_seconds,
                form_score=round(form, 1),
            )
        )
    exercise_set = ExerciseSet(
        session_id=session.id,
        exercise_name=exercise,
        muscle_groups=muscles_for(exercise),
        reps=reps,
        form_score=_mean(r.form_score for r in rep_rows),
        range_of_motion=_mean(r.range_of_motion for r in rep_rows),
        symmetry=_mean(r.symmetry for r in rep_rows),
        avg_rep_seconds=_mean(r.rep_seconds for r in rep_rows),
        started_at=start,
        ended_at=t,
        recorded_at=t,
    )
    return exercise_set, rep_rows, t


def _heart_rate_readings(rng, session, active_windows, max_hr):
    """One reading per 20s clip from start to end. Heart rate chases a
    target: the exercise's intensity during a set, a light-activity level
    during warm-up and rest. It rises quickly and recovers slowly, so it
    builds across a circuit like it does in real life."""
    readings = []
    hr = rng.uniform(86, 96)
    t = session.started_at
    while t < session.ended_at:
        mid = t + timedelta(seconds=CLIP_SEC / 2)
        active = next((w for w in active_windows if w[0] <= mid <= w[1]), None)
        target = max_hr * (active[2] if active else 0.64)
        hr += (target - hr) * (0.6 if active else 0.2) + rng.gauss(0, 2)
        readings.append(
            VitalsReading(
                session_id=session.id,
                recorded_at=t,
                window_sec=CLIP_SEC,
                heart_rate_bpm=round(hr, 1),
                breathing_rate_bpm=round(12 + (hr - 70) * 0.13 + rng.gauss(0, 0.8), 1),
                hrv_ms=round(max(12.0, 62 - (hr - 70) * 0.35 + rng.gauss(0, 3)), 1),
                source="seed",
            )
        )
        t += timedelta(seconds=CLIP_SEC)
    return readings


def seed_workouts(user, now=None, rng_seed=7):
    """Create the demo workouts for `user`; returns how many rows of each."""
    rng = random.Random(rng_seed)
    now = now or datetime.now(timezone.utc)
    local_tz = datetime.now().astimezone().tzinfo  # so workouts land at sensible local hours
    max_hr = user.estimated_max_heart_rate or 190
    counts = {"workouts": 0, "sets": 0, "reps": 0, "vitals": 0}

    for i, days_ago in enumerate(WORKOUT_DAYS_AGO):
        progress = i / (len(WORKOUT_DAYS_AGO) - 1)
        day = (now.astimezone(local_tz) - timedelta(days=days_ago)).date()
        hour, minute = rng.choice([(7, 0), (7, 30), (12, 15), (18, 0), (18, 30), (19, 0)])
        started_at = datetime(day.year, day.month, day.day, hour, minute, tzinfo=local_tz).astimezone(timezone.utc)

        session = WorkoutSession(user_id=user.id, started_at=started_at, status="ended")
        db.session.add(session)
        db.session.flush()  # session.id for the rows below

        t = started_at + timedelta(minutes=rng.uniform(3, 5))  # warm-up before the first set
        active_windows = []
        for exercise, reps in _plan_workout(rng, progress):
            exercise_set, rep_rows, t_end = _make_set(rng, session, exercise, reps, t, progress)
            db.session.add(exercise_set)
            db.session.flush()  # exercise_set.id for its reps
            for rep in rep_rows:
                rep.set_id = exercise_set.id
            db.session.add_all(rep_rows)
            active_windows.append((t, t_end, EXERCISES[exercise]["hr"]))
            counts["sets"] += 1
            counts["reps"] += len(rep_rows)
            t = t_end + timedelta(seconds=rng.uniform(60, 150))  # rest before the next set

        session.ended_at = t + timedelta(minutes=rng.uniform(1, 3))  # cool-down
        session.duration_sec = round((session.ended_at - session.started_at).total_seconds())

        # One early workout without heart rate, as if the camera couldn't
        # read it, so the "reps only" effort path has data too.
        if i != 2:
            readings = _heart_rate_readings(rng, session, active_windows, max_hr)
            db.session.add_all(readings)
            counts["vitals"] += len(readings)
        counts["workouts"] += 1

    db.session.commit()
    return counts


def delete_workouts(user):
    """Remove every workout (and its sets, reps and vitals) for `user`."""
    ids = [s.id for s in WorkoutSession.query.filter_by(user_id=user.id)]
    if ids:
        for model in (RepEvent, VitalsReading, ExerciseSet):
            model.query.filter(model.session_id.in_(ids)).delete(synchronize_session=False)
        WorkoutSession.query.filter(WorkoutSession.id.in_(ids)).delete(synchronize_session=False)
        db.session.commit()
    return len(ids)
