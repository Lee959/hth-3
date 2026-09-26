function StopIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

/**
 * The session's only control: end the workout. Same size, drop shadow, and
 * hover "pop" as StartWorkoutDock.jsx's "Start workout" button (Dashboard.jsx)
 * — the exact same classes, just StopIcon/"End Workout" in place of
 * PlayIcon/"Start workout" — so ending a workout reads as the same
 * primary-action language as starting one, at the same scale.
 */
export default function SessionControls({ onEndSession }) {
  return (
    <button
      type="button"
      onClick={onEndSession}
      aria-label="End workout"
      className="group relative rounded-full transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] focus-visible:outline-none motion-reduce:transition-opacity"
    >
      <span
        aria-hidden="true"
        className="absolute -inset-5 rounded-full bg-gradient-to-r from-rose-500/40 via-fuchsia-500/30 to-teal-400/30 opacity-70 blur-2xl transition-[opacity,transform,filter] duration-500 ease-out group-hover:scale-125 group-hover:opacity-100 group-hover:blur-3xl group-hover:saturate-150 group-focus-visible:scale-125 group-focus-visible:opacity-100 group-focus-visible:blur-3xl motion-reduce:group-hover:scale-100 motion-reduce:group-focus-visible:scale-100"
      />
      <span className="liquid-glass relative flex items-center gap-4 rounded-full py-2.5 pl-2.5 pr-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-1 group-hover:scale-105 group-hover:border-white/35 group-hover:shadow-[0_24px_60px_-10px_rgba(0,0,0,0.85),0_0_40px_-6px_rgba(244,63,94,0.55)] group-focus-visible:-translate-y-1 group-focus-visible:scale-105 group-focus-visible:border-white/60 motion-reduce:group-hover:translate-y-0 motion-reduce:group-hover:scale-100 motion-reduce:group-focus-visible:translate-y-0 motion-reduce:group-focus-visible:scale-100">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-900 shadow-[0_0_30px_rgba(255,255,255,0.45)] transition duration-300 group-hover:scale-110 group-hover:shadow-[0_0_44px_rgba(255,255,255,0.75)] group-focus-visible:scale-110 motion-reduce:group-hover:scale-100 motion-reduce:group-focus-visible:scale-100">
          <StopIcon className="h-6 w-6" />
        </span>
        <span className="whitespace-nowrap font-rajdhani text-lg font-bold uppercase tracking-[0.15em] text-white">
          End workout
        </span>
      </span>
    </button>
  )
}
