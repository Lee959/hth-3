function prettify(name) {
  if (!name) return null
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatStopwatch(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Shows either the live rep count for the active exercise, or a rest
 * stopwatch between sets (see useExerciseTracker's phase state machine).
 */
export default function RepCounter({ phase, exerciseName, reps, restElapsedMs = 0 }) {
  if (phase === 'resting') {
    return (
      <div className="rounded-3xl border border-white/20 bg-white/10 p-4 text-center shadow-lg backdrop-blur-xl">
        <p className="text-sm uppercase tracking-wide text-white/60">Resting</p>
        <p className="text-5xl font-bold tabular-nums text-white">{formatStopwatch(restElapsedMs)}</p>
        <p className="text-sm text-white/60">since last set</p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-white/20 bg-white/10 p-4 text-center shadow-lg backdrop-blur-xl">
      <p className="text-sm uppercase tracking-wide text-white/60">{prettify(exerciseName)}</p>
      <p className="text-5xl font-bold text-white">{reps}</p>
      <p className="text-sm text-white/60">reps</p>
    </div>
  )
}
