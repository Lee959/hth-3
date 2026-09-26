export const ASSUMED_MAX_HR = 180 // placeholder until the app has a real user-configured max HR

// Same 5-zone model most fitness watches use (% of max HR), color-coded
// low to high. Shared between HeartRateGauge.jsx (live dial) and the
// Workout Saved summary screen (average HR + zone for the whole session).
export const HEART_RATE_ZONES = [
  { max: 60, label: 'Resting', color: '#60a5fa' },
  { max: 70, label: 'Warm Up', color: '#22d3ee' },
  { max: 80, label: 'Aerobic', color: '#4ade80' },
  { max: 90, label: 'Anaerobic', color: '#fb923c' },
  { max: Infinity, label: 'Max', color: '#f87171' },
]

export function zoneForPct(pct) {
  return HEART_RATE_ZONES.find((z) => pct <= z.max) ?? HEART_RATE_ZONES[HEART_RATE_ZONES.length - 1]
}

export function zoneForBpm(bpm, maxHr = ASSUMED_MAX_HR) {
  if (!bpm) return null
  const pct = Math.max(0, Math.min(100, (bpm / maxHr) * 100))
  return zoneForPct(pct)
}
