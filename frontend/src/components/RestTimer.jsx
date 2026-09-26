import GlassTile from './GlassTile.jsx'

function formatStopwatch(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Rest stopwatch — shown top-middle only while phase === 'resting' (see
 * useExerciseTracker's phase state machine). Same Anton font as
 * RepCounter.jsx's rep count, one size down (`text-5xl` vs `text-6xl`), so
 * the two read as the same "big number" family without competing for the
 * same visual weight when only one of them is ever on screen at a time.
 */
export default function RestTimer({ restElapsedMs }) {
  return (
    <GlassTile className="px-6 py-3 text-center">
      <p className="font-anton text-5xl leading-none tabular-nums text-white">{formatStopwatch(restElapsedMs)}</p>
      <p className="mt-1 font-rajdhani text-sm font-light uppercase tracking-wide text-white/60">Rest</p>
    </GlassTile>
  )
}
