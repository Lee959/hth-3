import { useEffect, useState } from 'react'

// Tiny sample size: we only want average colors, and this keeps the
// per-tick cost to a few hundred pixels.
const SAMPLE_W = 24
const SAMPLE_H = 18
const INTERVAL_MS = 500

// Regions of the frame (as fractions of width/height) whose average colors
// drive the three ambient glows: left edge, right edge, bottom band.
const REGIONS = [
  { x0: 0, x1: 0.35, y0: 0, y1: 1 },
  { x0: 0.65, x1: 1, y0: 0, y1: 1 },
  { x0: 0.2, x1: 0.8, y0: 0.6, y1: 1 },
]

/**
 * Pushes an averaged color toward a vivid version of itself. Raw webcam
 * averages are mostly muddy beige/grey; boosting saturation and lifting
 * very dark values keeps the glows reading as colored light instead of
 * dirt, while still following the hue of whatever's in the room.
 */
function vivid([r, g, b]) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const mid = (max + min) / 2
  const boost = (v) => Math.round(mid + (v - mid) * 2.2)
  const lift = max < 90 ? 90 / Math.max(max, 1) : 1
  return [r, g, b].map((v) => Math.max(0, Math.min(255, boost(v) * lift)))
}

function averageRegion(data, { x0, x1, y0, y1 }) {
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let y = Math.floor(y0 * SAMPLE_H); y < Math.ceil(y1 * SAMPLE_H); y++) {
    for (let x = Math.floor(x0 * SAMPLE_W); x < Math.ceil(x1 * SAMPLE_W); x++) {
      const i = (y * SAMPLE_W + x) * 4
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      n++
    }
  }
  return n ? [r / n, g / n, b / n] : [0, 0, 0]
}

/**
 * Samples a playing <video> a couple of times a second and returns three
 * `rgb(...)` strings (left, right, bottom) derived from what the camera
 * sees — or null until the first frame has been read.
 */
export function useCameraPalette(videoRef, live) {
  const [palette, setPalette] = useState(null)

  useEffect(() => {
    if (!live) {
      setPalette(null)
      return undefined
    }
    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE_W
    canvas.height = SAMPLE_H
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const timer = setInterval(() => {
      const video = videoRef.current
      if (!ctx || !video || video.readyState < 2) return
      ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H)
      const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H)
      setPalette(REGIONS.map((region) => `rgb(${vivid(averageRegion(data, region)).join(' ')})`))
    }, INTERVAL_MS)
    return () => clearInterval(timer)
  }, [videoRef, live])

  return palette
}
