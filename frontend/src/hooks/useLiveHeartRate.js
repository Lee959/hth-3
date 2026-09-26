import { useEffect, useRef, useState } from 'react'

import { MIN_SNR_DB, WINDOW_S, estimateHeartRate } from '../lib/rppg.js'

// How often the reading refreshes. Each one looks back over the last
// WINDOW_S seconds, like a smartwatch; estimating costs ~1-2 ms.
const UPDATE_MS = 500
// Keep showing the last good reading this long when a window is too noisy
// (e.g. mid-rep), rather than flickering to "no data".
const HOLD_MS = 5000
// Weight of the previous face position in the running average: pose
// landmarks jitter a pixel or so per frame on a far-away face, which would
// otherwise swamp the pulse (see backend/app/rppg_engine/face_roi.py).
const ROI_SMOOTHING = 0.8
// Below this ear-to-ear width (px) the face is too small to read.
const MIN_FACE_PX = 12

// MediaPipe Pose landmark indices.
const NOSE = 0
const LEFT_EAR = 7
const RIGHT_EAR = 8

/**
 * Live heart rate from the camera: every video frame, averages the skin
 * color over the cheeks and nose (located with the pose landmarks already
 * tracked for rep counting, which work with the whole body in frame), then
 * every UPDATE_MS turns the last WINDOW_S seconds of color into a heart
 * rate (lib/rppg.js). Runs entirely in the browser; nothing is uploaded.
 *
 * Returns the latest heart rate in bpm, or null until one is measured.
 */
export function useLiveHeartRate(videoRef, landmarks, { running = true } = {}) {
  const landmarksRef = useRef(landmarks)
  landmarksRef.current = landmarks
  const [bpm, setBpm] = useState(null)

  useEffect(() => {
    const video = videoRef.current
    if (!running || !video) return undefined

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const samples = []
    let roi = null
    let lastUpdate = 0
    let lastGood = -Infinity
    let handle = null
    const useFrameCallback = 'requestVideoFrameCallback' in video

    function sampleSkin() {
      const lm = landmarksRef.current
      const width = video.videoWidth
      const height = video.videoHeight
      if (!lm || !width) return null
      const faceWidth = Math.hypot((lm[LEFT_EAR].x - lm[RIGHT_EAR].x) * width, (lm[LEFT_EAR].y - lm[RIGHT_EAR].y) * height)
      if (faceWidth < MIN_FACE_PX) return null
      const found = { cx: lm[NOSE].x * width, cy: lm[NOSE].y * height, sx: faceWidth * 0.2, sy: faceWidth * 0.15 }
      const smooth = (prev, next) => ROI_SMOOTHING * prev + (1 - ROI_SMOOTHING) * next
      roi = roi
        ? { cx: smooth(roi.cx, found.cx), cy: smooth(roi.cy, found.cy), sx: smooth(roi.sx, found.sx), sy: smooth(roi.sy, found.sy) }
        : found

      // Gaussian-weighted mean: weights fade toward the edge, so a small
      // shift of the region barely changes the color.
      const x0 = Math.max(0, Math.floor(roi.cx - 3 * roi.sx))
      const y0 = Math.max(0, Math.floor(roi.cy - 3 * roi.sy))
      const x1 = Math.min(width, Math.ceil(roi.cx + 3 * roi.sx))
      const y1 = Math.min(height, Math.ceil(roi.cy + 3 * roi.sy))
      const w = x1 - x0
      const h = y1 - y0
      if (w <= 0 || h <= 0) return null
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      ctx.drawImage(video, x0, y0, w, h, 0, 0, w, h)
      const { data } = ctx.getImageData(0, 0, w, h)
      let r = 0
      let g = 0
      let b = 0
      let total = 0
      for (let j = 0; j < h; j++) {
        const wy = Math.exp(-0.5 * ((y0 + j + 0.5 - roi.cy) / roi.sy) ** 2)
        for (let i = 0; i < w; i++) {
          const weight = wy * Math.exp(-0.5 * ((x0 + i + 0.5 - roi.cx) / roi.sx) ** 2)
          const p = 4 * (j * w + i)
          r += weight * data[p]
          g += weight * data[p + 1]
          b += weight * data[p + 2]
          total += weight
        }
      }
      return { r: r / total, g: g / total, b: b / total }
    }

    function onFrame(now, metadata) {
      // The camera's own capture time when the browser gives it; the display
      // time otherwise (quantized to screen refreshes, still close enough).
      const t = (metadata?.captureTime ?? now) / 1000
      const last = samples[samples.length - 1]
      if (!last || t > last.t) {
        const color = sampleSkin()
        if (!color) roi = null
        // A gap (face lost, tab hidden) breaks the rhythm: start over.
        if (!color || (last && t - last.t > 0.5)) samples.length = 0
        if (color) samples.push({ t, ...color })
        while (samples.length && samples[0].t < t - WINDOW_S) samples.shift()
      }

      if (now - lastUpdate >= UPDATE_MS) {
        lastUpdate = now
        const estimate = estimateHeartRate(samples)
        if (estimate && estimate.snrDb >= MIN_SNR_DB) {
          lastGood = now
          setBpm(estimate.bpm)
        } else if (now - lastGood > HOLD_MS) {
          setBpm(null)
        }
      }
      schedule()
    }

    function schedule() {
      handle = useFrameCallback ? video.requestVideoFrameCallback(onFrame) : requestAnimationFrame(onFrame)
    }

    schedule()
    return () => {
      if (useFrameCallback) video.cancelVideoFrameCallback(handle)
      else cancelAnimationFrame(handle)
      setBpm(null)
    }
  }, [videoRef, running])

  return bpm
}
