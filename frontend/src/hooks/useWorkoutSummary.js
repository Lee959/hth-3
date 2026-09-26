import { useAuthedGet } from './useAuthedGet.js'

/** All-time totals for the home page (GET /api/workouts/summary). */
export function useWorkoutSummary() {
  const { status, data } = useAuthedGet('/workouts/summary')
  return { status, summary: data }
}
