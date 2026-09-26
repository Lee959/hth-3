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
