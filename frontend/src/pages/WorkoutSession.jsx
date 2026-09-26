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
import { createWorkoutSaver } from '../lib/workoutSaver.js'
import { buildWorkoutSummary } from '../lib/workoutSummary.js'
import { attachAuthToken } from '../services/api.js'

// Placeholder goal until the app has a real user-configured target.
const TARGET_REPS = 10
// Shortest stretch a heart rate reading is recorded for (the last one, when
// the workout ends, covers whatever's left since the one before). New
// measurements arrive every 0.5 s at best, but each covers ~8 s of video,
// so recording them more often would mostly repeat the same one.
const MIN_READING_MS = 1000

// A tracked set as POST /workouts/:id/sets takes it.
function setForSaving(set) {
  return {
    exercise_name: set.exerciseName,
    reps: set.reps,
    // Averaged per-rep movement quality (see lib/repQuality.js).
    ...set.quality,
  }
}

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
  const heartRateBpm = useLiveHeartRate(videoRef, landmarks, {
    running: ready && !paused,
    onReading: ({ bpm, windowSec }) => recordHeartRate(Date.now(), bpm, windowSec),
  })
  const [vitals, setVitals] = useState([])
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    if (isAuthenticated) attachAuthToken(getAccessTokenSilently)
  }, [isAuthenticated, getAccessTokenSilently])

  // Workouts save when logged in, or in dev mode (no Auth0) as the
  // backend's demo user (DEV_USER_SUB).
  const canSave = isAuthenticated || !configured

  // The workout being recorded, saved to the database as it goes (see
  // lib/workoutSaver.js); each new workout gets a fresh one.
  const saverRef = useRef(null)
  if (saverRef.current === null) saverRef.current = createWorkoutSaver()
  // The saver whose workout has been started in the database, once it has.
  const [savingTo, setSavingTo] = useState(null)

  // start() only creates the workout once, so StrictMode running this
  // effect twice in development doesn't leave a second, empty one behind.
  function startSaving() {
    saverRef.current.start()
    setSavingTo(saverRef.current)
  }

  useEffect(() => {
    if (canSave) startSaving()
  }, [canSave])

  // Records a heart rate for the stretch since the last reading: kept
  // (newest first, like the backend's list) for the summary's average, and
  // saved to the workout. Called with each new measurement (see
  // useLiveHeartRate), and at the end with whatever is showing. A stretch
  // goes back at most `windowSec`, the video the measurement came from, so
  // time with no heart rate isn't credited to the reading after it.
  // Returns the reading, or null if none was recorded.
  const heartRateRef = useRef(null)
  heartRateRef.current = heartRateBpm
  const lastReadingAtRef = useRef(saverRef.current.startedAt)
  function recordHeartRate(now, bpm = heartRateRef.current, windowSec = null) {
    const from = windowSec == null ? lastReadingAtRef.current : Math.max(lastReadingAtRef.current, now - windowSec * 1000)
    if (now - from < MIN_READING_MS) return null
    lastReadingAtRef.current = now
    if (bpm == null) return null
    const reading = {
      heart_rate_bpm: bpm,
      recorded_at: new Date(from).toISOString(),
      window_sec: (now - from) / 1000,
    }
    setVitals((prev) => [reading, ...prev])
    saverRef.current.add('reading', reading)
    return reading
  }

  // Save each completed set as it closes (see useExerciseTracker's
  // resting-phase transition).
  useEffect(() => {
    if (completedSets.length === 0) return
    saverRef.current.add('set', setForSaving(completedSets[completedSets.length - 1]))
  }, [completedSets.length])

  // Ends the workout at `endedAt`: records its last pieces — the set still
  // in progress, if any, and the heart rate since the last reading — then
  // has the saver send everything not saved yet and mark it ended. The
  // closed set is saved directly here: reset() empties completedSets in
  // the same batched update, so the effect above never sees it (and can't
  // double-save it). Returns both (either may be null) for the summary.
  function endWorkout(endedAt) {
    const lastSet = closeSet()
    if (lastSet) saverRef.current.add('set', setForSaving(lastSet))
    const lastReading = recordHeartRate(endedAt)
    saverRef.current.end(endedAt)
    return { lastSet, lastReading }
  }

  // Leaving the page (browser back, another route) ends the workout too, so
  // it isn't left "active". Set up only once it's started, not on mount,
  // where StrictMode's extra unmount would end it straight away; through a
  // ref so the cleanup sees current state.
  const leaveRef = useRef(null)
  leaveRef.current = (saver) => {
    if (saver === saverRef.current && !saver.ended) endWorkout(Date.now())
  }
  useEffect(() => {
    if (!savingTo) return undefined
    return () => leaveRef.current(savingTo)
  }, [savingTo])

  function handleEndSession() {
    const endedAt = Date.now()
    const { lastSet, lastReading } = endWorkout(endedAt)
    // Snapshot everything the summary screen needs BEFORE reset() clears
    // the tracker's completedSets/totalRestMs. completedSets and vitals are
    // this render's values, so the just-recorded set and reading are added
    // explicitly.
    setSummary(
      buildWorkoutSummary({
        completedSets: lastSet ? [...completedSets, lastSet] : completedSets,
        totalDurationMs: endedAt - saverRef.current.startedAt,
        totalRestMs,
        vitals: lastReading ? [lastReading, ...vitals] : vitals,
      }),
    )
    reset()
    setPaused(true)
  }

  function handleNewWorkout() {
    setSummary(null)
    setVitals([])
    // The finished workout keeps saving in the background; this one gets its own.
    saverRef.current = createWorkoutSaver()
    lastReadingAtRef.current = saverRef.current.startedAt
    setPaused(false)
    if (canSave) startSaving()
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
