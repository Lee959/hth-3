import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

/**
 * Runs MediaPipe's PoseLandmarker (BlazePose, WASM, in-browser) against the
 * shared <video> element from useCamera. This is the real-time half of the
 * tracking pipeline — it never leaves the browser, so rep counting / form
 * feedback has no network round trip. Requires network access on first load
 * to fetch the WASM runtime + model file from Google's CDN (they're cached
 * by the browser after that).
 */
export function usePoseDetection(videoRef, { running = true } = {}) {
  const landmarkerRef = useRef(null)
  const rafRef = useRef(null)
  const [landmarks, setLandmarks] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE)
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      })
      if (cancelled) {
        landmarker.close()
        return
      }
      landmarkerRef.current = landmarker
      loop()
    }

    function loop() {
      const video = videoRef.current
      const landmarker = landmarkerRef.current
      if (running && video && landmarker && video.readyState >= 2) {
        const result = landmarker.detectForVideo(video, performance.now())
        if (result.landmarks?.length) {
          setLandmarks(result.landmarks[0])
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    init()
    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      landmarkerRef.current?.close()
    }
  }, [videoRef, running])

  return landmarks
}
