import { useEffect, useState } from 'react'

import CameraFeed from '../components/CameraFeed.jsx'
import MetricsSidebar from '../components/MetricsSidebar.jsx'
import MuscleHeatmap from '../components/MuscleHeatmap.jsx'
import RepCounter from '../components/RepCounter.jsx'
import SetHistory from '../components/SetHistory.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { useCamera } from '../hooks/useCamera.js'
import { useExerciseTracker } from '../hooks/useExerciseTracker.js'
import { usePoseDetection } from '../hooks/usePoseDetection.js'
import { useVitalsUpload } from '../hooks/useVitalsUpload.js'
import { api, attachAuthToken } from '../services/api.js'

export default function WorkoutSession() {
  const { isAuthenticated, getAccessTokenSilently, configured } = useAuth()
  const { videoRef, stream, ready } = useCamera()
  const [paused, setPaused] = useState(false)
  const landmarks = usePoseDetection(videoRef, { running: ready && !paused })
  const { phase, exerciseName, reps, scores, speed, peakAcceleration, restElapsedMs, completedSets, reset } =
    useExerciseTracker(landmarks)
  const [sessionId, setSessionId] = useState(null)
  const [vitals, setVitals] = useState([])

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
    reset()
    setPaused(true)
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      {!configured && (
        <p className="mb-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Log in requires Auth0 to be configured (see docs/SETUP.md). Workout sessions won't save
          until then, but the camera + live tracking below still works.
        </p>
      )}
      <div className="flex flex-col gap-4 md:flex-row">
        <MetricsSidebar
          vitals={vitals}
          reps={reps}
          speed={speed}
          peakAcceleration={peakAcceleration}
          isPaused={paused}
          onTogglePause={() => setPaused((p) => !p)}
          onReset={reset}
          onEndSession={handleEndSession}
        />

        <div className="flex flex-1 flex-col gap-4">
          <CameraFeed videoRef={videoRef} />
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
            <div className="flex flex-col gap-4">
              <RepCounter phase={phase} exerciseName={exerciseName} reps={reps} restElapsedMs={restElapsedMs} />
              <SetHistory sets={completedSets} />
            </div>
            <MuscleHeatmap scores={scores} />
          </div>
        </div>
      </div>
    </div>
  )
}
