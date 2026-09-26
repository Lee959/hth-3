/**
 * Heart rate from face skin color (remote photoplethysmography), computed in
 * the browser so it can update continuously. Each heartbeat pushes blood
 * into the face and shifts skin color very slightly; given recent per-frame
 * mean skin RGB (see hooks/useLiveHeartRate.js), this:
 *
 * 1. projects the colors with POS (Wang et al. 2017, "Algorithmic Principles
 *    of Remote PPG"): normalizing each ~1.6 s stretch by its own mean color
 *    cancels brightness and shading changes, leaving the pulse,
 * 2. finds the strongest rhythm between 42 and 210 bpm (a direct Fourier
 *    transform at each candidate rate, using the frames' real timestamps),
 * 3. scores that peak's SNR, so noise isn't reported as a heart rate.
 *
 * Same method as the backend's app/rppg_engine (after
 * github.com/hschn58/rPPG), minus the server round trip.
 */

const MIN_BPM = 42
const MAX_BPM = 210
const BPM_STEP = 0.5
const POS_WINDOW_S = 1.6

// Seconds of video each reading looks back over. How often readings update
// is separate (see useLiveHeartRate). On synthetic traces, 8 s kept ~100% of
// passing readings within 5 bpm; 6 s got 8%+ wrong and 5 s 20%+, because
// fewer beats make noise look like a rhythm.
export const WINDOW_S = 8
const MIN_DURATION_S = WINDOW_S - 0.5
// Readings whose peak doesn't clear this are treated as noise: pure-noise
// 8 s traces pass it ~1.5% of the time.
export const MIN_SNR_DB = 2

function posPulse(samples) {
  const n = samples.length
  const fps = (n - 1) / (samples[n - 1].t - samples[0].t)
  const window = Math.max(2, Math.round(POS_WINDOW_S * fps))
  const pulse = new Float64Array(n)
  for (let start = 0; start + window <= n; start++) {
    let mr = 0
    let mg = 0
    let mb = 0
    for (let i = start; i < start + window; i++) {
      mr += samples[i].r
      mg += samples[i].g
      mb += samples[i].b
    }
    mr /= window
    mg /= window
    mb /= window
    const s1 = new Float64Array(window)
    const s2 = new Float64Array(window)
    for (let k = 0; k < window; k++) {
      const { r, g, b } = samples[start + k]
      s1[k] = g / mg - b / mb
      s2[k] = -2 * (r / mr) + g / mg + b / mb
    }
    const alpha = std(s1) / (std(s2) || 1e-12)
    let mean = 0
    for (let k = 0; k < window; k++) mean += s1[k] + alpha * s2[k]
    mean /= window
    for (let k = 0; k < window; k++) pulse[start + k] += s1[k] + alpha * s2[k] - mean
  }
  return pulse
}

function std(values) {
  let mean = 0
  for (const v of values) mean += v
  mean /= values.length
  let sq = 0
  for (const v of values) sq += (v - mean) ** 2
  return Math.sqrt(sq / values.length)
}

/**
 * samples: [{ t (seconds), r, g, b }], oldest first. Returns
 * { bpm, snrDb } for the strongest rhythm, or null if there isn't enough
 * signal yet. Compare snrDb against MIN_SNR_DB before trusting bpm.
 */
export function estimateHeartRate(samples) {
  const n = samples.length
  if (n < 2) return null
  const t0 = samples[0].t
  const duration = samples[n - 1].t - t0
  if (duration < MIN_DURATION_S) return null

  // Remove the linear trend (slow lighting drift), then taper the ends.
  const pulse = posPulse(samples)
  let st = 0
  let sp = 0
  let stt = 0
  let stp = 0
  for (let i = 0; i < n; i++) {
    const t = samples[i].t - t0
    st += t
    sp += pulse[i]
    stt += t * t
    stp += t * pulse[i]
  }
  const slope = (n * stp - st * sp) / (n * stt - st * st)
  const intercept = (sp - slope * st) / n
  const x = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const t = samples[i].t - t0
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / duration)
    x[i] = (pulse[i] - slope * t - intercept) * hann
  }

  const bpms = []
  const power = []
  for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm += BPM_STEP) {
    const w = (2 * Math.PI * bpm) / 60
    let re = 0
    let im = 0
    for (let i = 0; i < n; i++) {
      const phase = w * (samples[i].t - t0)
      re += x[i] * Math.cos(phase)
      im += x[i] * Math.sin(phase)
    }
    bpms.push(bpm)
    power.push(re * re + im * im)
  }

  let peak = 0
  for (let i = 1; i < power.length; i++) if (power[i] > power[peak]) peak = i
  const peakBpm = bpms[peak]
  // A tapered sinusoid spreads over +-2/duration Hz; count that lobe (and
  // the first harmonic's) as signal and the rest of the band as noise.
  const lobeBpm = (2 / duration) * 60
  let signal = 0
  let noise = 0
  for (let i = 0; i < power.length; i++) {
    const nearPeak = Math.abs(bpms[i] - peakBpm) <= lobeBpm || Math.abs(bpms[i] - 2 * peakBpm) <= lobeBpm
    if (nearPeak) signal += power[i]
    else noise += power[i]
  }
  return { bpm: peakBpm, snrDb: 10 * Math.log10(signal / noise) }
}
