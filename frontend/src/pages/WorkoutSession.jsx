import { useEffect, useRef, useState } from 'react'

import CameraFeed from '../components/CameraFeed.jsx'
import ConnectionWarning from '../components/ConnectionWarning.jsx'
import ExerciseTitle from '../components/ExerciseTitle.jsx'
import GaugeRing from '../components/GaugeRing.jsx'
import MetricsSidebar from '../components/MetricsSidebar.jsx'
import MuscleHeatmap from '../components/MuscleHeatmap.jsx'
import RepCounter from '../components/RepCounter.jsx'
import RestTimer from '../components/RestTimer.jsx'
import SessionControls from '../components/SessionControls.jsx'
import WorkoutSummary from '../components/WorkoutSummary.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { useCamera } from '../hooks/useCamera.js'
import { useExerciseTracker } from '../hooks/useExerciseTracker.js'
import { usePoseDetection } from '../hooks/usePoseDetection.js'
import { useLiveHeartRate } from '../hooks/useLiveHeartRate.js'
import { buildWorkoutSummary, stubSaveWorkoutSummary } from '../lib/workoutSummary.js'
import { api, attachAuthToken } from '../services/api.js'

// Placeholder goal until the app has a real user-configured target.
const TARGET_REPS = 10
// How often the live heart rate is saved (for the summary and dashboard).
const SAVE_HEART_RATE_MS = 5000

// Every HUD element here is a small, independently-positioned glass tile
// (or a narrow stack of them) rather than full-width side panels, so the
// same absolute layout works from phone to desktop without a separate
// breakpoint-specific structure. The top nav bar is hidden globally on
// this route (see App.jsx) for an immersive view — there's no back button
// on this screen either, so the one way out is ending the workout (see
// SessionControls.jsx) or the browser's own back navigation.
export default function WorkoutSession() {
  const { isAuthenticated, getAccessTokenSilently, configured } = useAuth()
  const { videoRef, stream, ready } = useCamera()
  const [paused, setPaused] = useState(false)
  const landmarks = usePoseDetection(videoRef, { running: ready && !paused })
  const {
    phase,
    exerciseName,
    reps,
    scores,
    restElapsedMs,
    totalRestMs,
    completedSets,
    reset,
    closeSet,
  } = useExerciseTracker(landmarks)
  const heartRateBpm = useLiveHeartRate(videoRef, landmarks, { running: ready && !paused })
  const [sessionId, setSessionId] = useState(null)
  const [vitals, setVitals] = useState([])
  const [summary, setSummary] = useState(null)
  const sessionStartedAtRef = useRef(Date.now())

  useEffect(() => {
    if (isAuthenticated) attachAuthToken(getAccessTokenSilently)
  }, [isAuthenticated, getAccessTokenSilently])

  // Workouts save when logged in, or in dev mode (no Auth0) as the
  // backend's demo user (DEV_USER_SUB).
  const canSave = isAuthenticated || !configured
  // StrictMode runs effects twice in development; without this guard every
  // visit would create a second, empty session left "active" forever.
  const sessionRequested = useRef(false)

  function startSession() {
    setSessionId(null)
    api
      .post('/workouts/')
      .then((res) => setSessionId(res.data.id))
      .catch((err) => console.error('could not start workout session', err))
  }

  useEffect(() => {
    if (!canSave || sessionRequested.current) return
    sessionRequested.current = true
    startSession()
  }, [canSave])

  // Every few seconds, keep the live heart rate (newest first, like the
  // backend's list) for the summary's average, and save it to the workout.
  // Through a ref so the interval isn't reset by every new reading.
  const heartRateRef = useRef(null)
  heartRateRef.current = heartRateBpm
  useEffect(() => {
    const interval = setInterval(() => {
      const bpm = heartRateRef.current
      if (bpm == null) return
      const reading = {
        heart_rate_bpm: bpm,
        recorded_at: new Date(Date.now() - SAVE_HEART_RATE_MS).toISOString(),
        window_sec: SAVE_HEART_RATE_MS / 1000,
      }
      setVitals((prev) => [reading, ...prev])
      if (sessionId) {
        api.post(`/vitals/${sessionId}/readings`, reading).catch((err) => console.error('could not save heart rate', err))
      }
    }, SAVE_HEART_RATE_MS)
    return () => clearInterval(interval)
  }, [sessionId])

  // Returns the request's promise (or null) so ending can wait for it.
  function saveSet(set, id = sessionId) {
    if (!id || !set) return null
    return api
      .post(`/workouts/${id}/sets`, {
        exercise_name: set.exerciseName,
        reps: set.reps,
        // Averaged per-rep movement quality (see lib/repQuality.js).
        ...set.quality,
      })
      .catch((err) => console.error('could not save set', err))
  }

  // Ends workout `id` in the database once: saves `lastSet` (the set that
  // was still in progress, if any), waits for it to land, then marks the
  // session ended, so the end time comes after the last set.
  const endedSessions = useRef(new Set())
  function endInDatabase(id, lastSet) {
    if (!id || endedSessions.current.has(id)) return
    endedSessions.current.add(id)
    Promise.resolve(saveSet(lastSet, id))
      .then(() => api.post(`/workouts/${id}/end`))
      .catch((err) => console.error('could not end workout', err))
  }

  // Leaving the page (browser back, another route) ends the workout too, so
  // it isn't left "active". Through a ref so the cleanup sees current state.
  const leaveRef = useRef(null)
  leaveRef.current = (id) => {
    if (!endedSessions.current.has(id)) endInDatabase(id, closeSet())
  }
  useEffect(() => {
    if (!sessionId) return undefined
    const id = sessionId
    return () => leaveRef.current(id)
  }, [sessionId])

  // Persist each completed set as it closes (see useExerciseTracker's
  // resting-phase transition) through the existing set-logging endpoint.
  useEffect(() => {
    if (completedSets.length === 0) return
    saveSet(completedSets[completedSets.length - 1])
  }, [sessionId, completedSets.length])

  // Closes and saves a set that's still in progress before clearing the
  // tracker, so ending mid-set never throws away logged reps. It's saved
  // directly here: reset() empties completedSets in the same batched
  // update, so the effect above never sees it (and can't double-save it).
  function handleEndSession() {
    const lastSet = closeSet()
    endInDatabase(sessionId, lastSet)
    // Snapshot everything the summary screen needs BEFORE reset() clears
    // the tracker's completedSets/totalRestMs. completedSets is this
    // render's value, so the just-closed set is added explicitly.
    const finishedSummary = buildWorkoutSummary({
      completedSets: lastSet ? [...completedSets, lastSet] : completedSets,
      totalDurationMs: Date.now() - sessionStartedAtRef.current,
      totalRestMs,
      vitals,
    })
    stubSaveWorkoutSummary(finishedSummary)
    setSummary(finishedSummary)
    reset()
    setPaused(true)
  }

  function handleNewWorkout() {
    setSummary(null)
    setVitals([])
    sessionStartedAtRef.current = Date.now()
    setPaused(false)
    // The finished workout was ended in the database; this one gets its own.
    if (canSave) startSession()
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <CameraFeed videoRef={videoRef} />

      {/* Top-middle: rest stopwatch, only while resting between sets */}
      {phase === 'resting' && restElapsedMs > 0 && (
        <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2">
          <RestTimer restElapsedMs={restElapsedMs} />
        </div>
      )}

      {/* Left: HUD-style metrics overlay, vertically centered like the right column.
          max-h + overflow-y-auto so it scrolls internally instead of running into
          the bottom controls/banner on short viewports — 5 tiles in the right
          column made this a real problem on mobile, not just a desktop nicety. */}
      <div className="absolute left-4 top-1/2 z-10 max-h-[62vh] -translate-y-1/2 overflow-y-auto">
        <MetricsSidebar vitals={vitals} heartRateBpm={heartRateBpm} />
      </div>

      {/* Right: exercise title, muscle map, rep count, rep goal — one vertical
          column, far right edge. Session-level stats (sets, duration, avg HR)
          are intentionally NOT shown live; they're captured in handleEndSession
          and surfaced all at once on the Workout Saved summary screen instead,
          so this column stays short enough to never need internal scrolling. */}
      <div className="absolute right-4 top-1/2 z-10 flex w-36 -translate-y-1/2 flex-col gap-3">
        <ExerciseTitle exerciseName={exerciseName} />
        <MuscleHeatmap scores={scores} />
        <RepCounter reps={reps} />
        <GaugeRing
          value={(reps / TARGET_REPS) * 100}
          label="Rep goal"
          sublabel={`${reps} / ${TARGET_REPS} reps`}
          color="#fb7185"
        />
      </div>

      {/* Bottom-middle: setup notice (if any) stacked above the single End
          Workout control — it's last in the flex-col so it stays pinned to
          the same bottom-6 position whether or not the banner above it is
          showing. Kept off the TOP of the screen entirely, since that's
          where the rest timer and (on narrow screens) the HUD tiles already
          compete for space. */}
      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3">
        <ConnectionWarning className="w-[90vw] max-w-sm" />
        {!configured && (
          <p className="w-[90vw] max-w-sm rounded-2xl border border-amber-300/30 bg-amber-500/20 p-3 text-center text-sm text-amber-100 shadow-lg backdrop-blur-xl">
            Dev mode: Auth0 isn't configured, so this workout saves to the demo user (see
            docs/SETUP.md to enable log in).
          </p>
        )}
        <SessionControls onEndSession={handleEndSession} />
      </div>

      {summary && <WorkoutSummary summary={summary} onDone={handleNewWorkout} stream={stream} />}
    </div>
  )
}
