function StopIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

/**
 * The session's only control: end the workout. Same badge size, drop
 * shadow, glow, and hover "pop" as StartWorkoutDock.jsx's "Start workout"
 * button (Dashboard.jsx) — but icon-only at rest (a plain circle around the
 * badge) rather than always showing the label, since this button floats
 * over the live HUD rather than sitting in its own dock: the label grows
 * in on hover/focus instead (`max-w-0 -> max-w-xs` on the label, not the
 * button, so the reveal slides instead of snapping; `pr-8` on the pill
 * grows in step to leave room for it).
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
      <span className="liquid-glass relative flex items-center overflow-hidden rounded-full py-2.5 pl-2.5 pr-2.5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] transition-[transform,box-shadow,border-color,padding-right] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-1 group-hover:scale-105 group-hover:border-white/35 group-hover:pr-8 group-hover:shadow-[0_24px_60px_-10px_rgba(0,0,0,0.85),0_0_40px_-6px_rgba(244,63,94,0.55)] group-focus-visible:-translate-y-1 group-focus-visible:scale-105 group-focus-visible:border-white/60 group-focus-visible:pr-8 motion-reduce:group-hover:translate-y-0 motion-reduce:group-hover:scale-100 motion-reduce:group-focus-visible:translate-y-0 motion-reduce:group-focus-visible:scale-100">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-slate-900 shadow-[0_0_30px_rgba(255,255,255,0.45)] transition duration-300 group-hover:scale-110 group-hover:shadow-[0_0_44px_rgba(255,255,255,0.75)] group-focus-visible:scale-110 motion-reduce:group-hover:scale-100 motion-reduce:group-focus-visible:scale-100">
          <StopIcon className="h-6 w-6" />
        </span>
        <span className="max-w-0 overflow-hidden whitespace-nowrap pl-0 font-rajdhani text-lg font-bold uppercase tracking-[0.15em] text-white opacity-0 transition-[max-width,opacity,padding-left] duration-300 group-hover:max-w-xs group-hover:pl-4 group-hover:opacity-100 group-focus-visible:max-w-xs group-focus-visible:pl-4 group-focus-visible:opacity-100">
          End workout
        </span>
      </span>
    </button>
  )
}
