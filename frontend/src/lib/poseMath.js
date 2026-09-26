// MediaPipe Pose (BlazePose) landmark indices — stable across versions.
// https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
export const LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
}

/**
 * Angle at point b (degrees), formed by segments b->a and b->c. Mirrors the
 * geometry in backend/app/pose_engine/rep_counter.py so both sides agree on
 * what a given angle means, even though only the JS version runs live.
 */
export function angleAt(landmarks, aIdx, bIdx, cIdx) {
  const a = landmarks[aIdx]
  const b = landmarks[bIdx]
  const c = landmarks[cIdx]
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)
  const deg = Math.abs((radians * 180) / Math.PI)
  return deg > 180 ? 360 - deg : deg
}

export function midpoint(landmarks, aIdx, bIdx) {
  const a = landmarks[aIdx]
  const b = landmarks[bIdx]
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** Exponential moving average — cheap jitter smoothing for a live signal. */
export function ema(previous, next, alpha = 0.3) {
  return previous == null ? next : previous + alpha * (next - previous)
}
