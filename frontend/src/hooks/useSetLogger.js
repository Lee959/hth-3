import { useCallback, useEffect, useRef } from 'react'

import { summarizeReps } from '../lib/repQuality.js'
import { api } from '../services/api.js'

/**
 * Saves the reps the tracker has scored (useExerciseTracker's `drainReps`)
 * to the backend as sets: one POST /workouts/<id>/sets per exercise, with
 * rep count and averaged form score / range of motion / symmetry / tempo.
 *
 * Flushes whenever the detected exercise changes (so each run of one
 * exercise becomes its own set) and whenever the caller asks — before an
 * end/reset — and on leaving the page. Without a session (not logged in)
 * the reps are simply dropped, since there's nowhere to save them.
 */
export function useSetLogger({ sessionId, exerciseName, drainReps }) {
  const sessionRef = useRef(sessionId)
  const drainRef = useRef(drainReps)
  sessionRef.current = sessionId
  drainRef.current = drainReps

  const flush = useCallback(() => {
    const reps = drainRef.current()
    const id = sessionRef.current
    if (!id || reps.length === 0) return

    const byExercise = {}
    for (const rep of reps) (byExercise[rep.exercise] ??= []).push(rep)
    for (const [exercise, group] of Object.entries(byExercise)) {
      api.post(`/workouts/${id}/sets`, { exercise_name: exercise, ...summarizeReps(group) }).catch(() => {
        // A dropped set only loses that set's stats; the workout carries on.
      })
    }
  }, [])

  useEffect(() => {
    flush()
  }, [exerciseName, flush])

  useEffect(() => flush, [flush])

  return flush
}
