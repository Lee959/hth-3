import { useAuthedGet } from './useAuthedGet.js'

/**
 * The signed-in user's workout history (GET /api/workouts/), newest first —
 * up to the API's 500-per-page maximum, which covers every workout for now.
 */
export function useWorkoutHistory() {
  const { status, data } = useAuthedGet('/workouts/?limit=500')
  return { status, sessions: data ?? [] }
}
