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

// Score points a full-weight muscle gains per rep — shared by the live
// heatmap (useExerciseTracker.js, which also decays this over time) and the
// Workout Saved summary's whole-session heatmap (summaryScoresFor below,
// which has no decay since it's a single point-in-time snapshot).
export const LOAD_PER_REP = 30

/**
 * Whole-session muscle load, built straight from completedSets — unlike the
 * live heatmap this isn't decayed over time or reset between sets, so it's
 * a simple running total (still capped at 100) across every set the workout
 * logged. Used by the Workout Saved summary screen's front+back heatmap.
 */
export function summaryScoresFor(completedSets) {
  const scores = {}
  for (const { exerciseName, reps } of completedSets) {
    for (const [muscle, weight] of Object.entries(muscleWeightsFor(exerciseName))) {
      scores[muscle] = Math.min(100, (scores[muscle] ?? 0) + LOAD_PER_REP * weight * reps)
    }
  }
  return scores
}
