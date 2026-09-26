import GlassTile from './GlassTile.jsx'
import HeartRateGauge from './HeartRateGauge.jsx'

function StatTile({ label, value, unit }) {
  return (
    <GlassTile className="p-3 text-center">
      <p className="font-rajdhani text-xs font-bold uppercase tracking-wide text-white/80">{label}</p>
      <p className="text-xl font-semibold text-white">{value}</p>
      <p className="font-rajdhani text-xs font-light text-white/50">{unit}</p>
    </GlassTile>
  )
}

/**
 * The heads-up-display metrics stack — each stat is its own glass tile
 * (see GlassTile.jsx), meant to float as a compact cluster in the corner
 * of the session screen. Rep goal lives in the right-hand column instead
 * (see WorkoutSession.jsx), right below the exercise title. Heart rate
 * comes from Presage (server-side, polled); breathing likewise. Speed/peak
 * acceleration (computed live by useExerciseTracker) used to have tiles
 * here too but were dropped from the HUD as noise — useExerciseTracker
 * still computes them internally, just nothing renders them now.
 */
export default function MetricsSidebar({ vitals }) {
  const latest = vitals?.[0]

  return (
    <div className="flex w-36 flex-col gap-2">
      <HeartRateGauge heartRateBpm={latest?.heart_rate_bpm} />
      <StatTile
        label="Breathing"
        value={latest?.breathing_rate_bpm ? Math.round(latest.breathing_rate_bpm) : '—'}
        unit="rpm"
      />
    </div>
  )
}
