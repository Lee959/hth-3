import assert from 'node:assert/strict'
import { test } from 'node:test'

import { WINDOW_S, createHeartRateTracker, estimateHeartRate } from './rppg.js'

function random(seed) {
  let a = seed >>> 0
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return () => Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform())
}

// Per-frame samples as useLiveHeartRate collects them, at ~30 fps. With
// repHz, the head bobs like squats and color follows it, much more than it
// follows the pulse: through the room's light, through a highlight (white
// light, which the POS projection doesn't fully cancel, and nonlinear in
// height, so it also swings at multiples of the rep rate), and as the
// sampled region lags behind the face onto differently colored skin.
function trace({ bpm, seconds = 30, repHz = 0, noise = 0.2, seed = 1 }) {
  const gauss = random(seed)
  const samples = []
  let roiY = 250
  for (let i = 0, t = 0; t < seconds; i++, t = i / 30 + 0.003 * gauss()) {
    const depth = repHz ? 1.5 * ((1 - Math.cos(2 * Math.PI * repHz * t)) / 2) ** 1.5 : 0
    const y = 250 + 40 * depth + 0.8 * gauss()
    roiY = 0.8 * roiY + 0.2 * y
    const light = 1 + 0.03 * depth
    const highlight = 2.5 * Math.exp(-(((depth - 0.9) / 0.35) ** 2))
    const shift = (0.02 * (y - roiY)) / 40
    const pulse = bpm ? 0.004 * Math.sin((2 * Math.PI * bpm * t) / 60) : 0
    const [r, g, b] = [170, 120, 100].map(
      (c, k) => c * light * (1 + pulse * [0.33, 0.77, 0.53][k] + shift * [1, -1, 0.5][k]) + highlight + noise * gauss(),
    )
    samples.push({ t, r, g, b, x: 640 + 0.8 * gauss(), y, size: 40, lagX: 0, lagY: y - roiY })
  }
  return samples
}

const lastWindow = (samples) => samples.filter((s) => s.t > samples.at(-1).t - WINDOW_S)

for (const bpm of [60, 95, 150]) {
  test(`recovers a resting heart rate of ${bpm} bpm`, () => {
    const estimate = estimateHeartRate(lastWindow(trace({ bpm })))
    assert.ok(Math.abs(estimate.bpm - bpm) <= 3, `got ${estimate.bpm}`)
    assert.ok(estimate.snrDb >= 3)
  })
}

test('measures the heart rate mid-squat, not the rep rate', () => {
  for (const [bpm, repHz] of [
    [120, 0.5],
    [135, 0.7],
  ]) {
    const samples = lastWindow(trace({ bpm, repHz }))
    const estimate = estimateHeartRate(samples)
    assert.ok(Math.abs(estimate.bpm - bpm) <= 5, `${bpm} bpm at ${repHz} Hz reps: got ${estimate.bpm}`)
    // Without head motion to cancel, the reps win.
    const colorOnly = estimateHeartRate(samples.map(({ t, r, g, b }) => ({ t, r, g, b })))
    assert.ok(Math.abs(colorOnly.bpm - bpm) > 10, `color only: got ${colorOnly.bpm}`)
  }
})

// Runs a tracker over a trace the way useLiveHeartRate does, every 0.5 s.
function track(samples) {
  const tracker = createHeartRateTracker()
  const readings = []
  for (let now = WINDOW_S; now <= samples.at(-1).t; now += 0.5) {
    const window = samples.filter((s) => s.t > now - WINDOW_S && s.t <= now)
    readings.push(tracker.update(window, now))
  }
  return readings
}

test('tracker reports fresh readings of a steady heart rate', () => {
  const readings = track(trace({ bpm: 80 }))
  const fresh = readings.filter((r) => r.fresh)
  assert.ok(fresh.length >= readings.length * 0.5, `${fresh.length} of ${readings.length} fresh`)
  for (const r of fresh) {
    assert.ok(Math.abs(r.bpm - 80) <= 3, `got ${r.bpm}`)
    assert.ok(r.windowSec >= WINDOW_S - 0.5 && r.windowSec <= WINDOW_S + 2.5, `windowSec ${r.windowSec}`)
  }
})

// Now and then noise looks like a clear rhythm for a few seconds and a
// reading appears; it shouldn't happen often.
test('tracker rarely shows a reading without a pulse', () => {
  let shown = 0
  let total = 0
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const readings = track(trace({ bpm: null, seconds: 60, noise: 0.4, seed }))
    shown += readings.filter((r) => r.bpm != null).length
    total += readings.length
  }
  assert.ok(shown <= total * 0.1, `shown ${shown} of ${total}`)
})
