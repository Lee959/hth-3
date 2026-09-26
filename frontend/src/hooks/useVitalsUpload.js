import { useEffect } from 'react'

import { api } from '../services/api.js'

// VP9 kept the faint skin-color pulse best in testing; the others are fallbacks.
const MIME_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
// The pulse is a sub-1% color change on a small, far-away face; at the
// browser's default bitrate compression smooths it away.
const VIDEO_BITS_PER_SECOND = 8_000_000

/**
 * Records rolling clips off the SAME MediaStream used for live pose
 * tracking and ships each one to the backend, which measures heart rate
 * from it (OpenCV rPPG, or Presage if configured). Each clip gets its own
 * MediaRecorder so it's a complete, decodable video file: with
 * `start(timeslice)` only the first chunk would carry the file header.
 */
export function useVitalsUpload(stream, sessionId, { chunkMs = 10000, enabled = true } = {}) {
  useEffect(() => {
    if (!enabled || !stream || !sessionId || typeof MediaRecorder === 'undefined') return undefined

    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
    let recorder = null
    let timer = null
    let stopped = false

    function recordClip() {
      const clipRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VIDEO_BITS_PER_SECOND })
      const parts = []
      const startedAt = Date.now()
      clipRecorder.ondataavailable = (event) => {
        if (event.data?.size) parts.push(event.data)
      }
      clipRecorder.onstop = () => {
        if (stopped) return // workout over: drop the partial clip
        recordClip()
        const type = clipRecorder.mimeType || 'video/webm'
        const form = new FormData()
        form.append('chunk', new Blob(parts, { type }), type.includes('mp4') ? 'chunk.mp4' : 'chunk.webm')
        form.append('started_at', String(startedAt))
        form.append('duration_sec', String((Date.now() - startedAt) / 1000))
        api.post(`/vitals/${sessionId}/chunks`, form).catch((err) => {
          console.error('vitals upload failed', err.response?.data?.error ?? err)
        })
      }
      clipRecorder.start()
      recorder = clipRecorder
      timer = setTimeout(() => clipRecorder.stop(), chunkMs)
    }

    recordClip()
    return () => {
      stopped = true
      clearTimeout(timer)
      if (recorder?.state === 'recording') recorder.stop()
    }
  }, [stream, sessionId, chunkMs, enabled])
}
