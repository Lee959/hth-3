import { Link } from 'react-router-dom'

import GaugeRing from './GaugeRing.jsx'

// Placeholder goals until the app has real user-configured targets.
const ASSUMED_MAX_HR = 180
const TARGET_REPS = 10

function StatPill({ label, value, unit }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-center shadow-lg backdrop-blur-xl">
      <p className="text-xs text-white/60">{label}</p>
      <p className="text-xl font-semibold text-white">{value}</p>
      <p className="text-xs text-white/50">{unit}</p>
    </div>
  )
}

function IconButton({ icon, label, onClick, to }) {
  const content = (
    <>
      <span className="text-xl leading-none">{icon}</span>
      <span className="mt-1 text-[10px] text-white/70">{label}</span>
    </>
  )
  const className =
    'flex flex-col items-center justify-center rounded-2xl bg-white/5 py-3 transition hover:bg-white/15'

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  )
}

/**
 * Left sidebar: two "Liquid Glass"-style ring gauges (heart rate zone, rep
 * goal progress), speed/acceleration stat pills, and quick-action buttons.
 * Heart rate comes from Presage (server-side, polled); everything else is
 * computed live client-side by useExerciseTracker.
 */
export default function MetricsSidebar({
  vitals,
  reps,
  speed = 0,
  peakAcceleration = 0,
  isPaused,
  onTogglePause,
  onReset,
  onEndSession,
}) {
  const latest = vitals?.[0]
  const heartRate = latest?.heart_rate_bpm
  const hrPct = heartRate ? (heartRate / ASSUMED_MAX_HR) * 100 : null
  const repGoalPct = (reps / TARGET_REPS) * 100

  return (
    <aside className="flex w-full flex-col gap-4 md:w-72">
      <div className="space-y-5 rounded-3xl border border-white/20 bg-white/10 p-5 shadow-lg backdrop-blur-xl">
        <GaugeRing
          value={hrPct}
          label="Heart rate zone"
          sublabel={heartRate ? `${Math.round(heartRate)} bpm` : 'awaiting vitals'}
          color="#5eead4"
        />
        <GaugeRing
          value={repGoalPct}
          label="Rep goal"
          sublabel={`${reps} / ${TARGET_REPS} reps`}
          color="#fb7185"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatPill
          label="Breathing"
          value={latest?.breathing_rate_bpm ? Math.round(latest.breathing_rate_bpm) : '—'}
          unit="rpm"
        />
        <StatPill label="Speed" value={(speed * 100).toFixed(0)} unit="rel/s" />
        <StatPill label="Peak accel" value={(peakAcceleration * 100).toFixed(0)} unit="rel/s²" />
      </div>

      <div className="grid grid-cols-4 gap-2 rounded-3xl border border-white/20 bg-white/10 p-3 shadow-lg backdrop-blur-xl">
        <IconButton icon="⟳" label="Reset" onClick={onReset} />
        <IconButton icon={isPaused ? '▶' : '⏸'} label={isPaused ? 'Resume' : 'Pause'} onClick={onTogglePause} />
        <IconButton icon="🕘" label="History" to="/history" />
        <IconButton icon="■" label="End" onClick={onEndSession} />
      </div>
    </aside>
  )
}
