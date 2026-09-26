import { useEffect, useRef, useState } from 'react'

import { LANDMARKS, angleAt, ema, midpoint } from '../lib/poseMath.js'
import { LOAD_PER_REP, muscleWeightsFor } from '../lib/muscleMap.js'
import { RepCounter } from '../lib/repCounter.js'
import { repSeconds, scoreRep, summarizeReps } from '../lib/repQuality.js'

const MIN_RANGE_DEG = 25 // degrees of swing required to flag a joint as a movement candidate

// How far back (ms) to look when picking which of the 4 candidate joints is
// the primary mover, scanned fresh each time we're resting with nothing
// pending. Generous on purpose — this only runs once per detection, not
// continuously.
const CLASSIFY_WINDOW_MS = 1000

// How far back (ms) to look when asking "is THIS specific candidate still
// swinging right now" for the *active*-phase stickiness check (see
// REST_DELAY_MS below — that's the real tolerance for pausing between reps;
// this window just needs to be short enough to be responsive, since
// REST_DELAY_MS's much longer wall-clock grace period is what actually
// keeps a set alive through the natural near-zero-velocity moment at the
// top/bottom of every rep).
const LIVENESS_WINDOW_MS = 300

const DECAY_PER_SECOND = 2 // score points/sec a muscle cools down when idle
const STOPWATCH_TICK_MS = 250 // how often the rest timer re-renders while idle

// How long (ms) the active exercise's own angle can read as "not swinging"
// (LIVENESS_WINDOW_MS) — a normal breather between reps, or just the
// natural pause at the top/bottom of a rep — before the set is considered
// over and the hook switches to `resting`. THIS IS THE KNOB TO TUNE if reps
// get cut off because the user paused too long between them (raise it), or
// if "resting" takes too long to kick in after they've actually stopped
// (lower it). Doesn't affect how quickly a *new* exercise is picked up from
// rest — that's gated by CONFIRM_DELAY_MS below instead.
const REST_DELAY_MS = 5000

// How long (ms) a newly-detected candidate is given to prove it's a real
// exercise before it's discarded. THIS IS THE KNOB TO TUNE if starting a
// real set feels laggy (raise it, though see the note below on what
// actually gates confirmation), or if you want incidental movements
// rejected faster. Note this is a *ceiling*, not a fixed wait: a candidate
// confirms the instant its angle actually reaches that exercise's genuine
// range of motion (see `reachedGenuineRange` below) — a deliberate rep
// reaching real depth confirms in well under a second, not 600ms; this
// constant only controls how long a movement that never gets there is
// allowed to keep "trying" before being written off as incidental (a hand
// twitch, adjusting stance) rather than the start of an exercise. The UI
// keeps showing Resting the whole time a candidate is pending.
const CONFIRM_DELAY_MS = 600

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

// Which RepCounter state actually represents "doing the exercise" for each
// one — not always "down". For squat/curl/push-up/crunch the contracted,
// small-angle position is the genuine effort (a deep knee bend, a curled
// elbow); for a jumping jack it's the opposite — arms *raised* (the large-
// angle "up" state) is the effort, and small-angle "down" is just arms
// resting at your sides, which is where the rep counter starts by default.
const EXERTION_STATE = {
  squat: 'down',
  bicep_curl: 'down',
  push_up: 'down',
  crunch: 'down',
  jumping_jack: 'up',
}

// Which buffer/current-angle "belongs" to each exercise, for the sticky
// active-phase check and the pending-confirmation check (see the doc
// comment below for why those are keyed differently from the fresh-from-
// rest candidate scan).
function angleAndBufFor(name, angles, buffers) {
  const key = name === 'push_up' || name === 'bicep_curl' ? 'elbow' : name
  const map = {
    squat: { angle: angles.knee, buf: buffers.knee },
    elbow: { angle: angles.elbow, buf: buffers.elbow },
    jumping_jack: { angle: angles.shoulder, buf: buffers.shoulder },
    crunch: { angle: angles.hipFlex, buf: buffers.hipFlex },
  }
  return map[key]
}

// Which joint's left/right pair belongs to each exercise, for per-rep
// symmetry scoring.
function jointFor(name) {
  if (name === 'push_up' || name === 'bicep_curl') return 'elbow'
  if (name === 'squat') return 'knee'
  if (name === 'jumping_jack') return 'shoulder'
  return 'hipFlex'
}

function pushTimed(buf, value, time, maxAgeMs) {
  buf.push({ value, time })
  while (buf.length > 1 && time - buf[0].time > maxAgeMs) buf.shift()
}

// Range over the whole buffer, or only entries within `windowMs` of the
// newest sample when given — see CLASSIFY_WINDOW_MS vs. LIVENESS_WINDOW_MS.
function rangeOf(buf, windowMs) {
  if (buf.length < 2) return 0
  const newestTime = buf[buf.length - 1].time
  const cutoff = windowMs != null ? newestTime - windowMs : -Infinity
  const values = []
  for (const entry of buf) if (entry.time >= cutoff) values.push(entry.value)
  return values.length < 2 ? 0 : Math.max(...values) - Math.min(...values)
}

function freshCounters() {
  return Object.fromEntries(
    Object.entries(THRESHOLDS).map(([name, { down, up }]) => [name, new RepCounter(down, up)]),
  )
}

/**
 * Turns raw MediaPipe landmarks into a live exercise guess, rep count, a
 * per-muscle-group LOAD score (0-100, feeds @musclemap/react as a heatmap),
 * a rest-vs-active phase with a stopwatch, and a simple movement-speed/
 * acceleration signal — all computed client-side from joint angles, every
 * frame, with no camera data ever leaving the browser.
 *
 * Recognizes 5 angle-based exercises: squat, bicep curl, push-up, jumping
 * jack, crunch (see THRESHOLDS above for the calibration source). Each one
 * reduces to a single joint angle swinging between an extended and bent
 * state:
 *   - knee angle swinging          -> squat
 *   - elbow angle swinging         -> bicep_curl or push_up, disambiguated
 *                                     by torso orientation (horizontal => push-up)
 *   - shoulder (arm-raise) angle   -> jumping_jack
 *   - hip-flexion angle            -> crunch
 *
 * Phase state machine (this is what kills the flickering between exercises
 * that a naive "whichever angle has the biggest range wins, every frame"
 * classifier produces): once an exercise is active, it stays *sticky* —
 * every subsequent frame only asks "is THIS exercise's own angle still
 * swinging enough (within LIVENESS_WINDOW_MS)?", never re-comparing against
 * the other 3 candidates. All 4 candidates are only re-scanned (over the
 * longer CLASSIFY_WINDOW_MS) when coming out of REST. A normal pause for
 * breath between reps doesn't end the set either: the active exercise's own
 * angle can read as "not swinging" for up to `REST_DELAY_MS` of wall-clock
 * time — comfortably longer than the brief near-zero-velocity moment at the
 * top/bottom of every single rep — before the set is considered over. Only
 * once that grace period elapses is the set logged into `completedSets`,
 * the muscle heatmap wiped, and the hook moved into `resting` with a live
 * stopwatch (ticked independently of the pose-detection framerate via
 * `STOPWATCH_TICK_MS`, so it keeps counting even if MediaPipe stops
 * producing frames). The next exercise detected from REST always starts
 * its rep counter at 0 — every burst of activity after a rest is a new
 * set, even if it's the same exercise as before.
 *
 * Entering activity is guarded differently, and deliberately not by the
 * same windowed-liveness check: a candidate detected while resting becomes
 * `pending` rather than immediately "active," and is confirmed the instant
 * its angle actually reaches that exercise's genuine range of motion (see
 * `EXERTION_STATE` — a real knee bend, a real elbow curl, arms actually
 * raised for a jack), not merely "moved more than MIN_RANGE_DEG." A generic
 * windowed range can't tell a brief one-off swing from the first half of a
 * real rep — both look identical for as long as the window still remembers
 * the swing — so confirmation is tied to a concrete, exercise-specific
 * milestone instead of a duration. `CONFIRM_DELAY_MS` is the ceiling: if a
 * candidate never reaches that genuine range within it, it's discarded
 * entirely (including any rep it was silently counting), as if it never
 * happened — this is what stops a hand twitch or a stance adjustment from
 * flashing up as a detected exercise. The UI shows Resting for the whole
 * pending window either way.
 *
 * This is a heuristic, not a trained classifier — it can still misfire when
 * two joints move together (e.g. a sloppy squat that also flexes the hips a
 * lot), and `crunch` in particular assumes the camera can actually see
 * someone lying down, a different framing than the other 4 standing moves.
 *
 * Speed/acceleration are in *relative* units (fraction of frame size per
 * second) — real signal, but not calibrated to real-world meters.
 *
 * Every counted rep is also scored for movement quality (range of motion,
 * left/right symmetry, tempo -> form score; see lib/repQuality.js) from the
 * extremes and side-to-side difference of the exercise's angle since the
 * previous rep. When a set closes, its reps' averages ride along on the
 * set as `quality` (the fields POST /api/workouts/:id/sets stores).
 * `closeSet()` closes an in-progress set on demand — ending or resetting a
 * session mid-set — so that set isn't lost.
 */
export function useExerciseTracker(landmarks) {
  const buffers = useRef({ knee: [], elbow: [], shoulder: [], hipFlex: [] })
  const phase = useRef('resting') // 'active' | 'resting'
  const activeExercise = useRef(null)
  const lastActiveAt = useRef(null) // last time the active exercise's angle was genuinely swinging
  const pending = useRef(null) // { exerciseName, startedAt, counter, scores } | null
  const restStartedAt = useRef(null)
  const counters = useRef(freshCounters())
  const scores = useRef({})
  const completedSets = useRef([])
  const motion = useRef({ lastPoint: null, lastTime: null, velocity: 0, accel: 0, peakAccel: 0 })
  const lastDecayTime = useRef(null)
  // Sum of every *finished* rest period this session (the current, still-
  // running one lives in restElapsedMs/restStartedAt until it closes out —
  // see the pending->active graduation branch below, the only place a rest
  // period ends). Not reset by a mid-set correction, only by `reset()`.
  const totalRestMs = useRef(0)
  // Per-rep quality: angle extremes + left/right difference for the rep in
  // progress, when each exercise last completed a rep (for tempo), and the
  // scored reps of the set in progress.
  const repWindow = useRef(null)
  const lastRepAt = useRef({})
  const setReps = useRef([])

  const [state, setState] = useState({
    phase: 'resting',
    exerciseName: null,
    reps: 0,
    scores: {},
    speed: 0,
    peakAcceleration: 0,
    restElapsedMs: 0,
    totalRestMs: 0,
    completedSets: [],
  })

  function reset() {
    buffers.current = { knee: [], elbow: [], shoulder: [], hipFlex: [] }
    phase.current = 'resting'
    activeExercise.current = null
    lastActiveAt.current = null
    pending.current = null
    restStartedAt.current = performance.now()
    counters.current = freshCounters()
    scores.current = {}
    completedSets.current = []
    motion.current = { lastPoint: null, lastTime: null, velocity: 0, accel: 0, peakAccel: 0 }
    lastDecayTime.current = null
    totalRestMs.current = 0
    repWindow.current = null
    lastRepAt.current = {}
    setReps.current = []
    setState({
      phase: 'resting',
      exerciseName: null,
      reps: 0,
      scores: {},
      speed: 0,
      peakAcceleration: 0,
      restElapsedMs: 0,
      totalRestMs: 0,
      completedSets: [],
    })
  }

  // Closes the active set (if any): logs it into `completedSets` — with its
  // reps' averaged movement quality — and drops into resting. Returns the
  // logged set, or null if there was nothing with reps to log.
  function closeActiveSet(now) {
    const finishedExercise = activeExercise.current
    let finishedSet = null
    if (finishedExercise) {
      const finishedReps = counters.current[finishedExercise].reps
      if (finishedReps > 0) {
        // The counter's rep count is authoritative; summarizeReps only
        // supplies the averaged quality fields.
        const { form_score, range_of_motion, symmetry, avg_rep_seconds } = summarizeReps(setReps.current)
        finishedSet = {
          exerciseName: finishedExercise,
          reps: finishedReps,
          completedAt: Date.now(),
          quality: { form_score, range_of_motion, symmetry, avg_rep_seconds },
        }
        completedSets.current = [...completedSets.current, finishedSet]
      }
    }
    phase.current = 'resting'
    activeExercise.current = null
    lastActiveAt.current = null
    restStartedAt.current = now
    scores.current = {}
    setReps.current = []
    repWindow.current = null
    return finishedSet
  }

  /** Closes a set in progress right now (ending or resetting mid-set); returns it, or null. */
  function closeSet() {
    if (phase.current !== 'active') return null
    const finishedSet = closeActiveSet(performance.now())
    setState((prev) => ({ ...prev, phase: 'resting', exerciseName: null, reps: 0, completedSets: completedSets.current }))
    return finishedSet
  }

  // Ticks the rest stopwatch on its own timer instead of piggybacking on
  // pose-detection frames, so it doesn't freeze if MediaPipe stops
  // producing landmarks (e.g. the person steps out of frame to rest).
  useEffect(() => {
    if (state.phase !== 'resting') return undefined
    const interval = setInterval(() => {
      setState((prev) => {
        if (prev.phase !== 'resting' || restStartedAt.current == null) return prev
        const restElapsedMs = performance.now() - restStartedAt.current
        return { ...prev, restElapsedMs, totalRestMs: totalRestMs.current + restElapsedMs }
      })
    }, STOPWATCH_TICK_MS)
    return () => clearInterval(interval)
  }, [state.phase])

  useEffect(() => {
    if (!landmarks) return

    const now = performance.now()
    if (phase.current === 'resting' && restStartedAt.current == null) {
      restStartedAt.current = now
    }

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
    // left/right symmetry can be scored; `angles` is their average.
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
    const angles = Object.fromEntries(Object.entries(sides).map(([joint, [l, r]]) => [joint, (l + r) / 2]))

    pushTimed(buffers.current.knee, angles.knee, now, CLASSIFY_WINDOW_MS)
    pushTimed(buffers.current.elbow, angles.elbow, now, CLASSIFY_WINDOW_MS)
    pushTimed(buffers.current.shoulder, angles.shoulder, now, CLASSIFY_WINDOW_MS)
    pushTimed(buffers.current.hipFlex, angles.hipFlex, now, CLASSIFY_WINDOW_MS)

    const shoulderMid = midpoint(landmarks, LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER)
    const hipMid = midpoint(landmarks, LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP)

    function resolveCandidateName(candidateName) {
      if (candidateName !== 'elbow') return candidateName
      // Torso roughly horizontal (shoulders/hips closer vertically than
      // horizontally) => push-up; upright torso moving the same angle => curl.
      const horizontal = Math.abs(shoulderMid.y - hipMid.y) < Math.abs(shoulderMid.x - hipMid.x)
      return horizontal ? 'push_up' : 'bicep_curl'
    }

    function trackedPointFor(exerciseName) {
      if (exerciseName === 'squat') return hipMid
      if (exerciseName === 'crunch') return shoulderMid
      return midpoint(landmarks, LANDMARKS.LEFT_WRIST, LANDMARKS.RIGHT_WRIST)
    }

    function updateMotion(trackedPoint) {
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
    }

    // Generic so it can drive either the committed active-phase counter/
    // scores/scored reps (counters.current/scores.current/setReps.current)
    // or a pending candidate's own provisional ones while it's still being
    // confirmed.
    function updateRepAndScore(counter, scoresObj, exerciseName, angle, scoredReps) {
      // A different exercise starts a fresh quality window, seeded from the
      // last ~1s of that joint's angles so the first rep's range isn't cut
      // short by however long detection took to lock on.
      const joint = jointFor(exerciseName)
      if (repWindow.current?.exerciseName !== exerciseName) {
        const recent = buffers.current[joint].map((entry) => entry.value)
        repWindow.current = {
          exerciseName,
          minAngle: Math.min(angle, ...recent),
          maxAngle: Math.max(angle, ...recent),
          diffSum: 0,
          diffCount: 0,
        }
      }
      const win = repWindow.current
      win.minAngle = Math.min(win.minAngle, angle)
      win.maxAngle = Math.max(win.maxAngle, angle)
      win.diffSum += Math.abs(sides[joint][0] - sides[joint][1])
      win.diffCount += 1

      const previousReps = counter.reps
      const reps = counter.update(angle)
      if (reps > previousReps) {
        for (const [muscle, weight] of Object.entries(muscleWeightsFor(exerciseName))) {
          scoresObj[muscle] = Math.min(100, (scoresObj[muscle] ?? 0) + LOAD_PER_REP * weight)
        }
        const scored = scoreRep(exerciseName, {
          minAngle: win.minAngle,
          maxAngle: win.maxAngle,
          sideDiffAvg: win.diffCount ? win.diffSum / win.diffCount : 0,
          seconds: repSeconds(exerciseName, lastRepAt.current[exerciseName], now),
        })
        if (scored) scoredReps.push(scored)
        lastRepAt.current[exerciseName] = now
        repWindow.current = { exerciseName, minAngle: angle, maxAngle: angle, diffSum: 0, diffCount: 0 }
      }
      return reps
    }

    function finishActiveSet() {
      closeActiveSet(now)
    }

    if (phase.current === 'active') {
      const { angle, buf } = angleAndBufFor(activeExercise.current, angles, buffers.current)
      const isSwinging = rangeOf(buf, LIVENESS_WINDOW_MS) > MIN_RANGE_DEG
      if (isSwinging) lastActiveAt.current = now
      const idleFor = now - (lastActiveAt.current ?? now)

      // Stay "active" through a normal pause between reps (idleFor hasn't
      // crossed REST_DELAY_MS yet), not just while the angle is mid-swing —
      // this is what lets someone breathe between reps instead of having to
      // chain them with zero gap to avoid falling into rest.
      if (isSwinging || idleFor < REST_DELAY_MS) {
        const reps = updateRepAndScore(
          counters.current[activeExercise.current],
          scores.current,
          activeExercise.current,
          angle,
          setReps.current,
        )
        updateMotion(trackedPointFor(activeExercise.current))
        setState({
          phase: 'active',
          exerciseName: activeExercise.current,
          reps,
          scores: { ...scores.current },
          speed: motion.current.velocity,
          peakAcceleration: motion.current.peakAccel,
          restElapsedMs: 0,
          totalRestMs: totalRestMs.current,
          completedSets: completedSets.current,
        })
        return
      }
      finishActiveSet()
    }

    // phase.current === 'resting'. If a candidate is already pending
    // confirmation, check IT specifically (sticky, same pattern as the
    // active phase) rather than re-scanning everything every frame.
    if (pending.current) {
      const { exerciseName, counter } = pending.current
      const { angle } = angleAndBufFor(exerciseName, angles, buffers.current)
      const stateBefore = counter.state
      updateRepAndScore(counter, pending.current.scores, exerciseName, angle, pending.current.scoredReps)

      const reachedGenuineRange = counter.state === EXERTION_STATE[exerciseName] && stateBefore !== counter.state

      if (reachedGenuineRange) {
        // Confirmed — graduate to active, carrying over whatever it
        // silently counted while pending. This closes out the rest period
        // that was running up to this point, so fold its length into the
        // session's running total before clearing restStartedAt.
        if (restStartedAt.current != null) totalRestMs.current += now - restStartedAt.current
        phase.current = 'active'
        activeExercise.current = exerciseName
        lastActiveAt.current = now
        counters.current[exerciseName] = counter
        scores.current = pending.current.scores
        setReps.current = pending.current.scoredReps
        restStartedAt.current = null
        pending.current = null
        updateMotion(trackedPointFor(exerciseName))
        setState({
          phase: 'active',
          exerciseName,
          reps: counter.reps,
          scores: { ...scores.current },
          speed: motion.current.velocity,
          peakAcceleration: motion.current.peakAccel,
          restElapsedMs: 0,
          totalRestMs: totalRestMs.current,
          completedSets: completedSets.current,
        })
        return
      }

      if (now - pending.current.startedAt >= CONFIRM_DELAY_MS) {
        // Never reached a genuine range of motion within the window —
        // discard it entirely, as if it never happened.
        pending.current = null
        repWindow.current = null
      }
    }

    // No pending candidate (never started, or just discarded above) —
    // scan all 4 over the classification window for a new one to start
    // confirming.
    if (!pending.current) {
      const candidates = [
        { name: 'squat', range: rangeOf(buffers.current.knee, CLASSIFY_WINDOW_MS), angle: angles.knee },
        { name: 'elbow', range: rangeOf(buffers.current.elbow, CLASSIFY_WINDOW_MS), angle: angles.elbow },
        {
          name: 'jumping_jack',
          range: rangeOf(buffers.current.shoulder, CLASSIFY_WINDOW_MS),
          angle: angles.shoulder,
        },
        { name: 'crunch', range: rangeOf(buffers.current.hipFlex, CLASSIFY_WINDOW_MS), angle: angles.hipFlex },
      ]
      const best = candidates.reduce((a, b) => (b.range > a.range ? b : a))
      if (best.range > MIN_RANGE_DEG) {
        // Don't apply this frame's angle yet — the `pending.current` branch
        // above is the single place that updates the counter and checks
        // for a genuine state transition (comparing before vs. after), so
        // the very first check happens next frame with that same logic,
        // rather than a separate (and easy to get subtly wrong) confirm
        // path here.
        const exerciseName = resolveCandidateName(best.name)
        pending.current = {
          exerciseName,
          startedAt: now,
          counter: new RepCounter(THRESHOLDS[exerciseName].down, THRESHOLDS[exerciseName].up),
          scores: {},
          scoredReps: [],
        }
      }
    }

    // Still resting, or a candidate is pending but hasn't confirmed yet —
    // the UI shows Resting either way.
    const restElapsedMs = restStartedAt.current != null ? now - restStartedAt.current : 0
    setState((prev) => ({
      phase: 'resting',
      exerciseName: null,
      reps: 0,
      scores: { ...scores.current },
      speed: 0,
      peakAcceleration: prev.peakAcceleration,
      restElapsedMs,
      totalRestMs: totalRestMs.current + restElapsedMs,
      completedSets: completedSets.current,
    }))
  }, [landmarks])

  return { ...state, reset, closeSet }
}
