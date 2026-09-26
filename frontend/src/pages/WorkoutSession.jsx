import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import CameraFeed from '../components/CameraFeed.jsx'
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
import { useVitalsUpload } from '../hooks/useVitalsUpload.js'
import { buildWorkoutSummary, stubSaveWorkoutSummary } from '../lib/workoutSummary.js'
import { api, attachAuthToken } from '../services/api.js'

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  )
}

// Placeholder goal until the app has a real user-configured target.
const TARGET_REPS = 10

// Every HUD element here is a small, independently-positioned glass tile
// (or a narrow stack of them) rather than full-width side panels, so the
// same absolute layout works from phone to desktop without a separate
// breakpoint-specific structure. The top nav bar is hidden globally on
// this route (see App.jsx) for an immersive view, so this page carries its
// own small way back to Home.
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
    speed,
    peakAcceleration,
    restElapsedMs,
    totalRestMs,
    completedSets,
    reset,
  } = useExerciseTracker(landmarks)
  const [sessionId, setSessionId] = useState(null)
  const [vitals, setVitals] = useState([])
  const [summary, setSummary] = useState(null)
  const sessionStartedAtRef = useRef(Date.now())

  useEffect(() => {
    if (isAuthenticated) attachAuthToken(getAccessTokenSilently)
  }, [isAuthenticated, getAccessTokenSilently])

  useEffect(() => {
    if (!isAuthenticated) return
    api.post('/workouts/').then((res) => setSessionId(res.data.id))
  }, [isAuthenticated])

  useVitalsUpload(stream, sessionId, { enabled: ready && Boolean(sessionId) })

  useEffect(() => {
    if (!sessionId) return undefined
    const interval = setInterval(() => {
      api.get(`/vitals/${sessionId}`).then((res) => setVitals(res.data))
    }, 5000)
    return () => clearInterval(interval)
  }, [sessionId])

  // Persist each completed set as it closes (see useExerciseTracker's
  // resting-phase transition) through the existing set-logging endpoint.
  useEffect(() => {
    if (!sessionId || completedSets.length === 0) return
    const latest = completedSets[completedSets.length - 1]
    api.post(`/workouts/${sessionId}/sets`, {
      exercise_name: latest.exerciseName,
      reps: latest.reps,
    })
  }, [sessionId, completedSets.length])

  function handleEndSession() {
    if (sessionId) api.post(`/workouts/${sessionId}/end`)
    // Snapshot everything the summary screen needs BEFORE reset() clears
    // the tracker's completedSets/totalRestMs.
    const finishedSummary = buildWorkoutSummary({
      completedSets,
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
    sessionStartedAtRef.current = Date.now()
    setPaused(false)
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <CameraFeed videoRef={videoRef} />

      <Link
        to="/"
        aria-label="Back to Home"
        title="Back to Home"
        className="absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-lg backdrop-blur-xl transition hover:bg-white/20"
      >
        <BackIcon />
      </Link>

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
        <MetricsSidebar vitals={vitals} speed={speed} peakAcceleration={peakAcceleration} />
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

      {/* Bottom-middle: setup notice (if any) stacked above pause/reset/end
          — controls are last in the flex-col so they stay pinned to the
          same bottom-6 position whether or not the banner above them is
          showing. Kept off the TOP of the screen entirely, since that's
          where the back button, rest timer, and (on narrow screens) the
          HUD tiles already compete for space. */}
      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3">
        {!configured && (
          <p className="w-[90vw] max-w-sm rounded-2xl border border-amber-300/30 bg-amber-500/20 p-3 text-center text-sm text-amber-100 shadow-lg backdrop-blur-xl">
            Log in requires Auth0 to be configured (see docs/SETUP.md). Workout sessions won't save
            until then, but the camera + live tracking below still works.
          </p>
        )}
        <SessionControls
          isPaused={paused}
          onTogglePause={() => setPaused((p) => !p)}
          onEndSession={handleEndSession}
          onReset={reset}
        />
      </div>

      {summary && <WorkoutSummary summary={summary} onDone={handleNewWorkout} />}
    </div>
  )
}
