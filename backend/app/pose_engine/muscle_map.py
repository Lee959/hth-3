"""Maps exercise names to the muscle groups they primarily train.

Keys use @musclemap/core's `MuscleGroup` enum names (see
frontend/src/lib/muscleMap.js, the weighted client-side counterpart used to
drive the live heatmap) so an ExerciseSet logged here and a heatmap frame
rendered on the frontend always agree on what a muscle is called.
"""

EXERCISE_MUSCLE_MAP = {
    "squat": ["QUADS", "GLUTES", "HAMSTRINGS"],
    "push_up": ["CHEST", "TRICEPS", "SHOULDERS_FRONT", "CORE"],
    "pull_up": ["LATS", "BICEPS", "SHOULDERS_REAR"],
    "bicep_curl": ["BICEPS", "FOREARMS"],
    "shoulder_press": ["SHOULDERS_FRONT", "TRICEPS"],
    "deadlift": ["HAMSTRINGS", "GLUTES", "BACK_LOWER"],
    "lunge": ["QUADS", "GLUTES"],
    "plank": ["CORE", "OBLIQUES"],
    "jumping_jack": ["SHOULDERS_SIDE", "CALVES", "CORE"],
    "crunch": ["CORE", "OBLIQUES"],
}


def muscles_for(exercise_name: str) -> list[str]:
    key = exercise_name.lower().strip().replace(" ", "_")
    return EXERCISE_MUSCLE_MAP.get(key, [])
