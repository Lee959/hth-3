import { useAuthedGet } from './useAuthedGet.js'

/**
 * One past workout in full (GET /api/workouts/<id>): its sets, heart-rate
 * readings, reps and effort score, for the history detail panel.
 */
export function useWorkoutDetail(sessionId) {
  const { status, data } = useAuthedGet(`/workouts/${sessionId}`)
  return { status, workout: data }
}
