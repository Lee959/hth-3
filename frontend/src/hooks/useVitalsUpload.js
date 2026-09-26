import { useEffect, useRef } from 'react'

import { api } from '../services/api.js'

/**
 * Records rolling chunks off the SAME MediaStream used for live pose
 * tracking and ships each one to the backend, which relays it to Presage.
 * Chunked (not one long recording) so the first vitals reading comes back
 * well before the workout ends.
 */
export function useVitalsUpload(stream, sessionId, { chunkMs = 20000, enabled = true } = {}) {
  const recorderRef = useRef(null)

  useEffect(() => {
    if (!enabled || !stream || !sessionId) return undefined

    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    recorderRef.current = recorder

    recorder.ondataavailable = async (event) => {
      if (!event.data || event.data.size === 0) return
      const form = new FormData()
      form.append('chunk', event.data, 'chunk.webm')
      try {
        await api.post(`/vitals/${sessionId}/chunks`, form)
      } catch (err) {
        console.error('vitals upload failed', err)
      }
    }

    recorder.start(chunkMs)
    return () => recorder.stop()
  }, [stream, sessionId, chunkMs, enabled])
}
