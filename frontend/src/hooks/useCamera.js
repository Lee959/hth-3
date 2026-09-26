import { useEffect, useRef, useState } from 'react'

/**
 * Opens the webcam ONCE and hands the same MediaStream to every consumer:
 * the live MediaPipe pose tracker and the MediaRecorder that ships clips to
 * Presage. Two separate getUserMedia() calls fight over the camera on most
 * browsers/OSes, so this hook is the single source of truth for the stream
 * (see docs/ARCHITECTURE.md for why this is the answer to the "one camera,
 * two consumers" problem).
 */
export function useCamera({ width = 640, height = 480 } = {}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width, height, facingMode: 'user' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setReady(true)
      } catch (err) {
        setError(err)
      }
    }

    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [width, height])

  return { videoRef, stream: streamRef.current, ready, error }
}
