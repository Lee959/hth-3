import { useEffect, useRef, useState } from 'react'

import { LANDMARKS, angleAt, ema, midpoint } from '../lib/poseMath.js'
import { muscleWeightsFor } from '../lib/muscleMap.js'
import { RepCounter } from '../lib/repCounter.js'
import { repSeconds, scoreRep } from '../lib/repQuality.js'

const ANGLE_WINDOW = 30 // ~1s of frames at 30fps
const MIN_RANGE_DEG = 25 // ignore standing-still jitter
const LOAD_PER_REP = 30 // score points a full-weight muscle gains per rep
const DECAY_PER_SECOND = 2 // score points/sec a muscle cools down when idle

// Angle thresholds are calibrated against the validated values in
// https://github.com/Pushtogithub23/Tracking-Physical-Activities-with-MediaPipe-and-OpenCV
// (per-exercise scripts under "4. Counting Squats", "6. Dumbbell Curl
// Counter", "7. Push-ups Tracker", "2. Jumping Jacks", "5. Crunch Counter"),
// widened in a few spots for jitter resistance against a live webcam feed
// instead of that project's curated recordings. Bench press, step-counting
// and jump-rope from that repo aren't included: bench press assumes an
// overhead camera looking down at someone lying on a bench (a different
// physical setup than a front-facing standing webcam), and step/jump-rope
// counters aren't muscle-targeted exercises, so they don't fit the LOAD
// heatmap this hook feeds.
const THRESHOLDS = {
  squat: { down: 100, up: 160 }, // knee angle (hip-knee-ankle)
  bicep_curl: { down: 30, up: 150 }, // elbow angle (shoulder-elbow-wrist)
  push_up: { down: 80, up: 155 }, // elbow angle (shoulder-elbow-wrist)
  jumping_jack: { down: 50, up: 100 }, // shoulder angle (hip-shoulder-elbow)
  crunch: { down: 50, up: 90 }, // hip-flexion angle (knee-hip-shoulder)
}

function pushBounded(arr, value, max) {
  arr.push(value)
  if (arr.length > max) arr.shift()
}

function rangeOf(buf) {
  return buf.length < 2 ? 0 : Math.max(...buf) - Math.min(...buf)
}

function freshCounters() {
  return Object.fromEntries(
    Object.entries(THRESHOLDS).map(([name, { down, up }]) => [name, new RepCounter(down, up)]),
  )
}

/**
 * Turns raw MediaPipe landmarks into a live exercise guess, rep count, a
 * per-muscle-group LOAD score (0-100, feeds @musclemap/react as a heatmap),
 * and a simple movement-speed/acceleration signal — all computed
 * client-side from joint angles, every frame, with no camera data ever
 * leaving the browser.
 *
 * Recognizes 5 angle-based exercises: squat, bicep curl, push-up, jumping
 * jack, crunch. Each one reduces to a single joint angle swinging between
 * an extended and bent state (see THRESHOLDS above for which angle and the
 * calibration source), so classification just tracks which angle is
 * actually moving over a ~1s window:
 *   - knee angle swinging          -> squat
 *   - elbow angle swinging         -> bicep_curl or push_up, disambiguated
 *                                     by torso orientation (horizontal => push-up)
 *   - shoulder (arm-raise) angle   -> jumping_jack
 *   - hip-flexion angle            -> crunch
 * This is a heuristic, not a trained classifier — it can misfire when two
 * joints move together (e.g. a sloppy squat that also flexes the hips a
 * lot), and `crunch` in particular assumes the camera can actually see
 * someone lying down, a different framing than the other 4 standing moves.
 *
 * The muscle heatmap wipes clean whenever the detected exercise changes
 * (so switching from squats to curls doesn't leave fading quad/glute color
 * blended with fresh bicep color) and otherwise accumulates LOAD points on
 * every completed rep, decaying slowly when idle — reflecting session
 * effort rather than just "currently active," matching @musclemap/react's
 * LOAD color model.
 *
 * Speed/acceleration are in *relative* units (fraction of frame size per
 * second) — real signal, but not calibrated to real-world meters.
 *
 * Every completed rep is also scored for movement quality (range of
 * motion, left/right symmetry, tempo -> form score; see lib/repQuality.js)
 * from the extremes and side-to-side difference of the exercise's angle
 * since the previous rep. Scored reps queue up until the caller collects
 * them with `drainReps()` (useSetLogger.js saves them as sets).
 */
export function useExerciseTracker(landmarks) {
  const kneeBuf = useRef([])
  const elbowBuf = useRef([])
  const shoulderBuf = useRef([])
  const hipFlexBuf = useRef([])
  const lastExercise = useRef(null)
  const counters = useRef(freshCounters())
  const scores = useRef({})
  const motion = useRef({ lastPoint: null, lastTime: null, velocity: 0, accel: 0, peakAccel: 0 })
  const lastDecayTime = useRef(null)
  // Angle extremes + left/right difference for the rep in progress.
  const repWindow = useRef(null)
  const lastRepAt = useRef({})
  const completedReps = useRef([])

  const [state, setState] = useState({
    exerciseName: null,
    reps: 0,
    scores: {},
    speed: 0,
    peakAcceleration: 0,
  })

  function reset() {
    kneeBuf.current = []
    elbowBuf.current = []
    shoulderBuf.current = []
    hipFlexBuf.current = []
    lastExercise.current = null
    counters.current = freshCounters()
    scores.current = {}
    motion.current = { lastPoint: null, lastTime: null, velocity: 0, accel: 0, peakAccel: 0 }
    lastDecayTime.current = null
    repWindow.current = null
    lastRepAt.current = {}
    completedReps.current = []
    setState({ exerciseName: null, reps: 0, scores: {}, speed: 0, peakAcceleration: 0 })
  }

  useEffect(() => {
    if (!landmarks) return

    const now = performance.now()

    // Decay every muscle a little each frame, regardless of what's active,
    // so the heatmap cools down after you stop moving.
    if (lastDecayTime.current) {
      const dtSec = (now - lastDecayTime.current) / 1000
      for (const key of Object.keys(scores.current)) {
        scores.current[key] = Math.max(0, scores.current[key] - DECAY_PER_SECOND * dtSec)
      }
    }
    lastDecayTime.current = now

    // Left and right kept separate (not just averaged) so each rep's
    // left/right symmetry can be scored.
    const sides = {
      knee: [
        angleAt(landmarks, LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE),
        angleAt(landmarks, LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE),
      ],
      elbow: [
        angleAt(landmarks, LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST),
        angleAt(landmarks, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST),
      ],
      shoulder: [
        angleAt(landmarks, LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW),
        angleAt(landmarks, LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW),
      ],
      hipFlex: [
        angleAt(landmarks, LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_SHOULDER),
        angleAt(landmarks, LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_SHOULDER),
      ],
    }
    const knee = (sides.knee[0] + sides.knee[1]) / 2
    const elbow = (sides.elbow[0] + sides.elbow[1]) / 2
    const shoulder = (sides.shoulder[0] + sides.shoulder[1]) / 2
    const hipFlex = (sides.hipFlex[0] + sides.hipFlex[1]) / 2

    pushBounded(kneeBuf.current, knee, ANGLE_WINDOW)
    pushBounded(elbowBuf.current, elbow, ANGLE_WINDOW)
    pushBounded(shoulderBuf.current, shoulder, ANGLE_WINDOW)
    pushBounded(hipFlexBuf.current, hipFlex, ANGLE_WINDOW)

    const shoulderMid = midpoint(landmarks, LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER)
    const hipMid = midpoint(landmarks, LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP)

    const candidates = [
      { name: 'squat', range: rangeOf(kneeBuf.current), angle: knee, buf: kneeBuf.current, sides: sides.knee },
      { name: 'elbow', range: rangeOf(elbowBuf.current), angle: elbow, buf: elbowBuf.current, sides: sides.elbow },
      {
        name: 'jumping_jack',
        range: rangeOf(shoulderBuf.current),
        angle: shoulder,
        buf: shoulderBuf.current,
        sides: sides.shoulder,
      },
      {
        name: 'crunch',
        range: rangeOf(hipFlexBuf.current),
        angle: hipFlex,
        buf: hipFlexBuf.current,
        sides: sides.hipFlex,
      },
    ]
    const best = candidates.reduce((a, b) => (b.range > a.range ? b : a))

    const previousExercise = lastExercise.current
    let exerciseName = previousExercise
    let primaryAngle = null
    if (best.range > MIN_RANGE_DEG) {
      if (best.name === 'elbow') {
        // Torso roughly horizontal (shoulders/hips closer vertically than
        // horizontally) => push-up; upright torso moving the same angle => curl.
        const horizontal = Math.abs(shoulderMid.y - hipMid.y) < Math.abs(shoulderMid.x - hipMid.x)
        exerciseName = horizontal ? 'push_up' : 'bicep_curl'
      } else {
        exerciseName = best.name
      }
      primaryAngle = best.angle
    }
    lastExercise.current = exerciseName

    // Switching exercises wipes the heatmap so it never blends two
    // different exercises' muscles together (see doc comment above).
    if (exerciseName && previousExercise && exerciseName !== previousExercise) {
      scores.current = {}
    }

    let reps = state.reps
    if (exerciseName && primaryAngle != null) {
      // A new exercise starts a fresh window, seeded from the last ~1s of
      // that joint's angles so the first rep's range isn't cut short by
      // however long detection took to lock on.
      if (repWindow.current?.exercise !== exerciseName) {
        repWindow.current = {
          exercise: exerciseName,
          minAngle: Math.min(...best.buf),
          maxAngle: Math.max(...best.buf),
          diffSum: 0,
          diffCount: 0,
        }
      }
      const win = repWindow.current
      win.minAngle = Math.min(win.minAngle, primaryAngle)
      win.maxAngle = Math.max(win.maxAngle, primaryAngle)
      win.diffSum += Math.abs(best.sides[0] - best.sides[1])
      win.diffCount += 1

      const previousReps = counters.current[exerciseName].reps
      reps = counters.current[exerciseName].update(primaryAngle)

      if (reps > previousReps) {
        const scored = scoreRep(exerciseName, {
          minAngle: win.minAngle,
          maxAngle: win.maxAngle,
          sideDiffAvg: win.diffCount ? win.diffSum / win.diffCount : 0,
          seconds: repSeconds(exerciseName, lastRepAt.current[exerciseName], now),
        })
        if (scored) completedReps.current.push(scored)
        lastRepAt.current[exerciseName] = now
        repWindow.current = { ...win, minAngle: primaryAngle, maxAngle: primaryAngle, diffSum: 0, diffCount: 0 }

        const weights = muscleWeightsFor(exerciseName)
        for (const [muscle, weight] of Object.entries(weights)) {
          const current = scores.current[muscle] ?? 0
          scores.current[muscle] = Math.min(100, current + LOAD_PER_REP * weight)
        }
      }
    }

    // Track whichever joint actually moves for the exercise in play.
    const trackedPoint =
      exerciseName === 'squat'
        ? hipMid
        : exerciseName === 'crunch'
          ? shoulderMid
          : midpoint(landmarks, LANDMARKS.LEFT_WRIST, LANDMARKS.RIGHT_WRIST)

    const m = motion.current
    if (m.lastPoint && m.lastTime) {
      const dt = (now - m.lastTime) / 1000
      if (dt > 0) {
        const dx = trackedPoint.x - m.lastPoint.x
        const dy = trackedPoint.y - m.lastPoint.y
        const rawVelocity = Math.hypot(dx, dy) / dt
        const rawAccel = (rawVelocity - m.velocity) / dt
        m.velocity = ema(m.velocity, rawVelocity, 0.4)
        m.accel = ema(m.accel, rawAccel, 0.4)
        m.peakAccel = Math.max(m.peakAccel, Math.abs(m.accel))
      }
    }
    m.lastPoint = trackedPoint
    m.lastTime = now

    setState({
      exerciseName,
      reps,
      scores: { ...scores.current },
      speed: m.velocity,
      peakAcceleration: m.peakAccel,
    })
  }, [landmarks])

  /** Hands over every rep scored since the last call, and forgets them. */
  function drainReps() {
    const reps = completedReps.current
    completedReps.current = []
    return reps
  }

  return { ...state, reset, drainReps }
}
