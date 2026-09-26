/**
 * Heart rate from face skin color (remote photoplethysmography), computed in
 * the browser so it can update continuously. Each heartbeat pushes blood
 * into the face and shifts skin color very slightly; given recent per-frame
 * mean skin RGB and head position (see hooks/useLiveHeartRate.js), this:
 *
 * 1. removes the part of each color channel that head motion explains (a
 *    least-squares fit on the head's position and size, and on how far the
 *    sampled region lags behind it): mid-rep, moving through the room's
 *    light changes skin color in step with the rep, by far more than the
 *    pulse does, and the rep's harmonics land right in the heart rate range,
 * 2. projects the colors with POS (Wang et al. 2017, "Algorithmic Principles
 *    of Remote PPG"): normalizing each ~1.6 s stretch by its own mean color
 *    cancels brightness and shading changes, leaving the pulse,
 * 3. finds the strongest rhythm between 42 and 210 bpm (a direct Fourier
 *    transform at each candidate rate, using the frames' real timestamps),
 *    favoring rates near the last reading, since heart rate moves gradually,
 * 4. scores that peak's SNR, so noise isn't reported as a heart rate.
 *
 * createHeartRateTracker() turns these per-window estimates into the
 * reading to show: it only starts from a clear peak, then follows fainter
 * ones that stay close to it, and takes a short median.
 *
 * Steps 2-4 are the backend's app/rppg_engine method (after
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

// Powers of the head's height used in the motion fit: light and highlights
// change nonlinearly with height, which squats sweep through, so the color
// swings at multiples of the rep rate too.
const HEIGHT_POWERS = 4
// Ridge penalty on the motion fit (relative to the frame count), so it
// doesn't chase landmark jitter when the head is still.
const MOTION_RIDGE = 1e-3

// Readings start only from a peak this clear (pure noise gets there in ~1%
// of windows); after that, estimates within TRACK_BPM of the last reading
// count down to TRACK_SNR_DB. On synthetic squat traces, a single 2 dB gate
// (with no motion fit) locked onto a multiple of the rep rate, putting
// 70-100% of readings over 10 bpm off; with both, 0-7% were.
const ACQUIRE_SNR_DB = 3
const TRACK_SNR_DB = 1
const TRACK_BPM = 12
// Favor rates near the last reading: weight the spectrum by a Gaussian this
// wide (bpm) over a floor, so a much stronger peak elsewhere still wins.
const PRIOR_SIGMA_BPM = 12
const PRIOR_FLOOR = 0.25
// How long the last reading keeps guiding the search after readings stop,
// and how fast (bpm per second) the allowed change grows meanwhile.
const TRACK_MEMORY_S = 8
const TRACK_BPM_PER_S = 1
// How long the last reading stays on screen when windows are too noisy
// (e.g. mid-rep), rather than flickering to "no data". Short, as heart rate
// climbs fast during a set.
const HOLD_S = 3
// Readings are the median of the estimates accepted over this many
// seconds, which damps jitter between overlapping windows.
const SMOOTH_S = 2

function mean(values) {
  let sum = 0
  for (const v of values) sum += v
  return sum / values.length
}

function std(values) {
  const m = mean(values)
  let sq = 0
  for (const v of values) sq += (v - m) ** 2
  return Math.sqrt(sq / values.length)
}

function standardize(values) {
  const m = mean(values)
  const sd = std(values)
  return sd > 1e-9 ? values.map((v) => (v - m) / sd) : null
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Columns for the motion fit: a constant and linear trend (unpenalized),
// then head motion, when the samples carry it.
function fitColumns(samples) {
  const column = (get) => standardize(Float64Array.from(samples, get))
  const cols = [new Float64Array(samples.length).fill(1), column((s) => s.t)]
  if (samples[0].x == null) return cols
  const x = column((s) => s.x)
  const y = column((s) => s.y)
  cols.push(x, y, column((s) => s.size), column((s) => s.lagX), column((s) => s.lagY))
  if (y) for (let p = 2; p <= HEIGHT_POWERS; p++) cols.push(standardize(y.map((v) => v ** p)))
  if (x) cols.push(standardize(x.map((v) => v * v)))
  if (x && y) cols.push(standardize(x.map((v, i) => v * y[i])))
  return cols.filter(Boolean)
}

// Least-squares fit of each signal on `cols` (all but the first two
// ridge-penalized); returns the residuals.
function regressOut(signals, cols) {
  const k = cols.length
  const n = cols[0].length
  const dot = (a, b) => {
    let s = 0
    for (let i = 0; i < n; i++) s += a[i] * b[i]
    return s
  }
  // Normal equations, augmented with one right-hand side per signal.
  const m = cols.map((a, i) => [
    ...cols.map((b, j) => dot(a, b) + (i === j && i >= 2 ? MOTION_RIDGE * n : 0)),
    ...signals.map((sig) => dot(a, sig)),
  ])
  for (let c = 0; c < k; c++) {
    let pivot = c
    for (let r = c + 1; r < k; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r
    ;[m[c], m[pivot]] = [m[pivot], m[c]]
    for (let r = c + 1; r < k; r++) {
      const f = m[r][c] / m[c][c]
      for (let j = c; j < m[r].length; j++) m[r][j] -= f * m[c][j]
    }
  }
  return signals.map((sig, s) => {
    const beta = new Float64Array(k)
    for (let c = k - 1; c >= 0; c--) {
      let v = m[c][k + s]
      for (let j = c + 1; j < k; j++) v -= m[c][j] * beta[j]
      beta[c] = v / m[c][c]
    }
    const out = Float64Array.from(sig)
    for (let c = 0; c < k; c++) for (let i = 0; i < n; i++) out[i] -= beta[c] * cols[c][i]
    return out
  })
}

function posPulse(r, g, b, fps) {
  const n = r.length
  const window = Math.max(2, Math.round(POS_WINDOW_S * fps))
  const pulse = new Float64Array(n)
  const s1 = new Float64Array(window)
  const s2 = new Float64Array(window)
  for (let start = 0; start + window <= n; start++) {
    let mr = 0
    let mg = 0
    let mb = 0
    for (let i = start; i < start + window; i++) {
      mr += r[i]
      mg += g[i]
      mb += b[i]
    }
    mr /= window
    mg /= window
    mb /= window
    for (let k = 0; k < window; k++) {
      const i = start + k
      s1[k] = g[i] / mg - b[i] / mb
      s2[k] = -2 * (r[i] / mr) + g[i] / mg + b[i] / mb
    }
    const alpha = std(s1) / (std(s2) || 1e-12)
    let h = 0
    for (let k = 0; k < window; k++) h += s1[k] + alpha * s2[k]
    h /= window
    for (let k = 0; k < window; k++) pulse[start + k] += s1[k] + alpha * s2[k] - h
  }
  return pulse
}

/**
 * samples: [{ t (seconds), r, g, b }], oldest first, optionally with head
 * motion { x, y, size, lagX, lagY } (pixels) to cancel. With expectedBpm,
 * rates near it are favored (see PRIOR_SIGMA_BPM). Returns { bpm, snrDb }
 * for the strongest rhythm, or null if there isn't enough signal yet.
 */
export function estimateHeartRate(samples, { expectedBpm = null, priorSigmaBpm = PRIOR_SIGMA_BPM } = {}) {
  const n = samples.length
  if (n < 2) return null
  const t0 = samples[0].t
  const duration = samples[n - 1].t - t0
  if (duration < MIN_DURATION_S) return null

  // Motion and slow lighting drift out of each channel, keeping its level.
  const cols = fitColumns(samples)
  const channels = ['r', 'g', 'b'].map((c) => Float64Array.from(samples, (s) => s[c]))
  const [r, g, b] = regressOut(channels, cols).map((res, c) => {
    const level = mean(channels[c])
    return res.map((v) => v + level)
  })

  // Remove what's left of the trend, then taper the ends.
  const [pulse] = regressOut([posPulse(r, g, b, (n - 1) / duration)], cols.slice(0, 2))
  const x = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * (samples[i].t - t0)) / duration)
    x[i] = pulse[i] * hann
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

  const prior = (bpm) =>
    expectedBpm == null ? 1 : PRIOR_FLOOR + (1 - PRIOR_FLOOR) * Math.exp(-0.5 * ((bpm - expectedBpm) / priorSigmaBpm) ** 2)
  let peak = 0
  for (let i = 1; i < power.length; i++) if (power[i] * prior(bpms[i]) > power[peak] * prior(bpms[peak])) peak = i
  // Between grid points: the top of a parabola through the peak and its neighbors.
  let peakBpm = bpms[peak]
  if (peak > 0 && peak < power.length - 1) {
    const [left, mid, right] = [power[peak - 1], power[peak], power[peak + 1]]
    const curve = left - 2 * mid + right
    if (curve < 0) peakBpm += ((0.5 * (left - right)) / curve) * BPM_STEP
  }
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

/**
 * Strings estimates into readings. Call update(samples, now) (now in
 * seconds, on the samples' clock) on each refresh; it returns { bpm, fresh,
 * windowSec }: bpm is the reading to show (null when there's none), fresh
 * is true when this update measured it (rather than holding the last one),
 * and windowSec is how many seconds of video a fresh reading covers.
 */
export function createHeartRateTracker() {
  let accepted = [] // { t, bpm, since }: estimates behind the current reading
  let last = null // { t, bpm }: the last accepted estimate
  let shown = null
  return {
    update(samples, now) {
      const age = last ? now - last.t : Infinity
      const remembered = age <= TRACK_MEMORY_S
      const slack = remembered ? TRACK_BPM_PER_S * age : 0
      const estimate = estimateHeartRate(
        samples,
        remembered ? { expectedBpm: last.bpm, priorSigmaBpm: PRIOR_SIGMA_BPM + slack } : {},
      )
      const onTrack = remembered && estimate && Math.abs(estimate.bpm - last.bpm) <= TRACK_BPM + slack
      if (estimate && (estimate.snrDb >= ACQUIRE_SNR_DB || (onTrack && estimate.snrDb >= TRACK_SNR_DB))) {
        // A new rhythm: don't blend it with the old one.
        if (!onTrack) accepted = []
        accepted = accepted.filter((a) => a.t > now - SMOOTH_S)
        accepted.push({ t: now, bpm: estimate.bpm, since: samples[0].t })
        last = { t: now, bpm: estimate.bpm }
        shown = median(accepted.map((a) => a.bpm))
        return { bpm: shown, fresh: true, windowSec: now - accepted[0].since }
      }
      if (age > HOLD_S) {
        shown = null
        accepted = []
      }
      return { bpm: shown, fresh: false, windowSec: null }
    },
  }
}
