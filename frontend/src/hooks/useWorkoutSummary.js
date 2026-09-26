import { useAuthedGet } from './useAuthedGet.js'

// A believable 20-minute interval session, sampled every 30s: warm-up,
// three work/rest blocks climbing in intensity, then a cool-down.
function sampleHeartRateTrace() {
  const points = []
  for (let t = 0; t <= 20 * 60; t += 30) {
    const min = t / 60
    let bpm
    if (min < 3) bpm = 92 + min * 12
    else if (min < 17) {
      const block = Math.floor((min - 3) / 4.67)
      const phase = ((min - 3) % 4.67) / 4.67
      const peak = 150 + block * 6
      bpm = phase < 0.65 ? 128 + (peak - 128) * (phase / 0.65) : peak - (peak - 128) * ((phase - 0.65) / 0.35)
    } else bpm = 128 - (min - 17) * 9
    points.push({ t_sec: t, bpm: Math.round(bpm + Math.sin(t / 45) * 2) })
  }
  return points
}

// Sample per-workout trend: one point every other day, ending today.
function sampleTrend(scores) {
  const day = 86_400_000
  return scores.map((score, i) => ({
    session_id: `sample-${i}`,
    started_at: new Date(Date.now() - (scores.length - 1 - i) * 2 * day).toISOString(),
    score,
  }))
}

/**
 * Shown while signed out, clearly badged as sample data, so the summary's
 * layout is visible before anyone has logged a workout.
 */
export const SAMPLE_SUMMARY = {
  total_workouts: 12,
  total_reps: 486,
  active_minutes: 214,
  reps_by_exercise: [
    { exercise: 'squat', reps: 180, form_score: 81, range_of_motion: 86, symmetry: 90, avg_rep_seconds: 2.4 },
    { exercise: 'push_up', reps: 120, form_score: 72, range_of_motion: 74, symmetry: 85, avg_rep_seconds: 1.9 },
    { exercise: 'bicep_curl', reps: 96, form_score: 84, range_of_motion: 90, symmetry: 88, avg_rep_seconds: 2.6 },
    { exercise: 'jumping_jack', reps: 60, form_score: 79, range_of_motion: 82, symmetry: 92, avg_rep_seconds: 0.9 },
    { exercise: 'crunch', reps: 30, form_score: 70, range_of_motion: 71, symmetry: 86, avg_rep_seconds: 1.8 },
  ],
  avg_heart_rate_bpm: 128,
  latest_heart_rate: { session_id: null, started_at: null, points: sampleHeartRateTrace() },
  form: { score: 78, trend: sampleTrend([70, 72, 71, 75, 74, 78, 77, 80, 79, 82]) },
  movement: { range_of_motion: 82, symmetry: 88, avg_rep_seconds: 2.1 },
  // Zone minutes and score are what the backend's services/effort.py
  // computes for the sample heart-rate trace above plus 42 reps.
  effort: {
    latest: { session_id: null, started_at: null, score: 55, zone_minutes: [2.5, 5.5, 8.5, 3, 0], has_heart_rate: true },
    average: 58,
    trend: sampleTrend([48, 62, 51, 66, 57, 60, 49, 64, 58, 55]),
    max_heart_rate: 190,
  },
}

/**
 * All-time totals for the home page (GET /api/workouts/summary). While
 * signed out it returns SAMPLE_SUMMARY with `isSample: true`.
 */
export function useWorkoutSummary() {
  const { status, data } = useAuthedGet('/workouts/summary')
  if (status === 'signed-out') return { status, summary: SAMPLE_SUMMARY, isSample: true }
  return { status, summary: data, isSample: false }
}
