import { useAuthedGet } from './useAuthedGet.js'

/** The signed-in user's recent workout sessions (GET /api/workouts/), newest first. */
export function useWorkoutHistory() {
  const { status, data } = useAuthedGet('/workouts/')
  return { status, sessions: data ?? [] }
}
