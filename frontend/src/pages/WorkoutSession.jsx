import { useEffect, useState } from 'react'

import CameraFeed from '../components/CameraFeed.jsx'
import MuscleBodyMap from '../components/MuscleBodyMap.jsx'
import RepCounter from '../components/RepCounter.jsx'
import VitalsPanel from '../components/VitalsPanel.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { useCamera } from '../hooks/useCamera.js'
import { usePoseDetection } from '../hooks/usePoseDetection.js'
import { useVitalsUpload } from '../hooks/useVitalsUpload.js'
import { api, attachAuthToken } from '../services/api.js'

// Placeholder — swap for the real angle-based counter the CV lead builds
// on top of the landmarks returned by usePoseDetection (see
// backend/app/pose_engine/rep_counter.py for the matching angle math).
function countReps() {
  return 0
}

export default function WorkoutSession() {
  const { isAuthenticated, getAccessTokenSilently, configured } = useAuth()
  const { videoRef, stream, ready } = useCamera()
  const landmarks = usePoseDetection(videoRef, { running: ready })
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

  const repCount = landmarks ? countReps(landmarks) : 0

  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4 md:grid-cols-3">
      {!configured && (
        <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-300 md:col-span-3">
          Log in requires Auth0 to be configured (see docs/SETUP.md). Workout sessions won't save
          until then, but the camera + pose preview below still works.
        </p>
      )}
      <div className="md:col-span-2">
        <CameraFeed videoRef={videoRef} />
      </div>
      <div className="flex flex-col gap-4">
        <RepCounter exerciseName="Squat" reps={repCount} />
        <MuscleBodyMap activeMuscles={['quadriceps', 'gluteal']} />
        <VitalsPanel vitals={vitals} />
      </div>
    </div>
  )
}
