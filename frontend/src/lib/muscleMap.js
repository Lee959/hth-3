/**
 * Exercise -> muscle group weights, keyed by @musclemap/core's `MuscleGroup`
 * enum (see node_modules/@musclemap/core/dist/index.d.ts for the full list).
 * Weight (0-1) scales how much of a rep's "load" each muscle gets — a squat
 * hits QUADS harder than HAMSTRINGS, for instance.
 *
 * Mirrors backend/app/pose_engine/muscle_map.py (which uses the same enum
 * names, just as a flat list for DB logging — it doesn't need weights).
 */
export const EXERCISE_MUSCLE_WEIGHTS = {
  squat: { QUADS: 1, GLUTES: 0.85, HAMSTRINGS: 0.5 },
  push_up: { CHEST: 1, TRICEPS: 0.7, SHOULDERS_FRONT: 0.6, CORE: 0.3 },
  bicep_curl: { BICEPS: 1, FOREARMS: 0.4 },
  jumping_jack: { SHOULDERS_SIDE: 0.8, CALVES: 0.6, CORE: 0.3 },
  crunch: { CORE: 1, OBLIQUES: 0.5 },
}

export function muscleWeightsFor(exerciseName) {
  return EXERCISE_MUSCLE_WEIGHTS[exerciseName] ?? {}
}
