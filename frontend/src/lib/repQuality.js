/**
 * Per-rep movement quality, scored from the same joint angles the rep
 * counter already tracks (see useExerciseTracker.js):
 *
 * - Range of motion: how much of the full movement the rep covered —
 *   (highest angle - lowest angle) / (`top` - `bottom`) for the exercise.
 * - Symmetry: how evenly the left and right sides moved — the average
 *   left/right difference in the tracked angle over the rep, where
 *   MAX_SIDE_DIFF_DEG or more of difference scores 0.
 * - Tempo: 100 inside the exercise's controlled-speed band; scaled down the
 *   further a rep falls outside it (rushed or stalled).
 *
 * Form score blends the three: 50% range of motion, 30% symmetry, 20%
 * tempo. These are heuristics over 2D webcam angles, not a biomechanics
 * lab measurement — good for "am I improving?" rather than absolute truth.
 */

// `bottom`/`top`: the joint angle (degrees) at the two ends of a full rep.
// `tempo`: controlled-speed band in seconds per rep.
export const REP_PROFILES = {
  squat: { bottom: 90, top: 170, tempo: [1.5, 4] }, // knee angle
  bicep_curl: { bottom: 40, top: 160, tempo: [1.5, 4] }, // elbow angle
  push_up: { bottom: 90, top: 165, tempo: [1.2, 4] }, // elbow angle
  jumping_jack: { bottom: 20, top: 160, tempo: [0.5, 1.6] }, // shoulder angle
  crunch: { bottom: 45, top: 100, tempo: [1, 3] }, // hip-flexion angle
}

const MAX_SIDE_DIFF_DEG = 30

// A gap this many times the slow end of the tempo band means the person
// paused between reps, so the gap isn't a rep duration at all.
const PAUSE_FACTOR = 3

const WEIGHTS = { rom: 0.5, symmetry: 0.3, tempo: 0.2 }

function clamp01(v) {
  return Math.max(0, Math.min(1, v))
}

/**
 * Rep duration in seconds, or null when it can't be known: the first rep
 * of a run (no previous rep to measure from) or a rep after a pause.
 */
export function repSeconds(exercise, previousRepAt, now) {
  const profile = REP_PROFILES[exercise]
  if (!profile || previousRepAt == null) return null
  const seconds = (now - previousRepAt) / 1000
  return seconds > profile.tempo[1] * PAUSE_FACTOR ? null : seconds
}

/**
 * Scores one completed rep. `minAngle`/`maxAngle` are the extremes of the
 * tracked angle during the rep, `sideDiffAvg` the mean |left - right| angle
 * difference, and `seconds` the rep duration (null if unknown, in which
 * case tempo is left out and the other two parts are reweighted).
 */
export function scoreRep(exercise, { minAngle, maxAngle, sideDiffAvg, seconds }) {
  const profile = REP_PROFILES[exercise]
  if (!profile) return null

  const rom = clamp01((maxAngle - minAngle) / (profile.top - profile.bottom)) * 100
  const symmetry = clamp01(1 - sideDiffAvg / MAX_SIDE_DIFF_DEG) * 100

  let tempo = null
  if (seconds != null) {
    const [fast, slow] = profile.tempo
    tempo = seconds < fast ? clamp01(seconds / fast) * 100 : seconds > slow ? clamp01(slow / seconds) * 100 : 100
  }

  const form =
    tempo == null
      ? (WEIGHTS.rom * rom + WEIGHTS.symmetry * symmetry) / (WEIGHTS.rom + WEIGHTS.symmetry)
      : WEIGHTS.rom * rom + WEIGHTS.symmetry * symmetry + WEIGHTS.tempo * tempo

  return { exercise, rom, symmetry, tempo, seconds, form }
}

function mean(values) {
  const present = values.filter((v) => v != null)
  return present.length ? present.reduce((a, b) => a + b, 0) / present.length : null
}

function round1(v) {
  return v == null ? null : Math.round(v * 10) / 10
}

/**
 * Collapses scored reps (all the same exercise) into the per-set fields
 * POST /api/workouts/<id>/sets stores.
 */
export function summarizeReps(reps) {
  return {
    reps: reps.length,
    form_score: round1(mean(reps.map((r) => r.form))),
    range_of_motion: round1(mean(reps.map((r) => r.rom))),
    symmetry: round1(mean(reps.map((r) => r.symmetry))),
    avg_rep_seconds: round1(mean(reps.map((r) => r.seconds))),
  }
}
