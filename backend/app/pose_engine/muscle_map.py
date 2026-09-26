"""Maps exercise names to the muscle groups they primarily train.

Keys match the muscle labels used by the react-body-highlighter component
on the frontend (see frontend/src/components/MuscleBodyMap.jsx) so a
detected exercise name can flow straight into the body map with no
translation layer in between.
"""

EXERCISE_MUSCLE_MAP = {
    "squat": ["quadriceps", "gluteal", "hamstring"],
    "push_up": ["chest", "triceps", "front-deltoids"],
    "pull_up": ["upper-back", "biceps", "back-deltoids"],
    "bicep_curl": ["biceps"],
    "shoulder_press": ["front-deltoids", "triceps"],
    "deadlift": ["hamstring", "gluteal", "lower-back"],
    "lunge": ["quadriceps", "gluteal"],
    "plank": ["abs", "obliques"],
}


def muscles_for(exercise_name: str) -> list[str]:
    key = exercise_name.lower().strip().replace(" ", "_")
    return EXERCISE_MUSCLE_MAP.get(key, [])
