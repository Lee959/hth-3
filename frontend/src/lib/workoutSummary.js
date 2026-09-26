import { summaryScoresFor } from './muscleMap.js'

/**
 * Builds the snapshot WorkoutSummary.jsx renders. Called once, in
 * WorkoutSession.jsx's handleEndSession, BEFORE useExerciseTracker's
 * reset() clears completedSets/totalRestMs — this is the only point where
 * that live state is still readable.
 */
export function buildWorkoutSummary({ completedSets, totalDurationMs, totalRestMs, vitals }) {
  const heartRates = (vitals ?? [])
    .map((v) => v.heart_rate_bpm)
    .filter((bpm) => typeof bpm === 'number' && bpm > 0)
  const avgHeartRateBpm = heartRates.length
    ? heartRates.reduce((sum, bpm) => sum + bpm, 0) / heartRates.length
    : null

  return {
    completedSets,
    totalDurationMs,
    totalRestMs,
    avgHeartRateBpm,
    scores: summaryScoresFor(completedSets),
    completedAt: Date.now(),
  }
}

/**
 * STUB — persistence isn't built yet. Once the workout-summary API/schema
 * exists, this is where WorkoutSummary.jsx's "save" action would POST the
 * snapshot (e.g. `api.post('/workouts/:id/summary', summary)`); for now it
 * just logs, so the UI has a real call site to wire up later without
 * touching any component.
 */
export function stubSaveWorkoutSummary(summary) {
  console.info('[stub] would persist workout summary:', summary)
  return Promise.resolve({ saved: false, reason: 'persistence not implemented yet' })
}
