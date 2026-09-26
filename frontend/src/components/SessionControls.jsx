function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

/**
 * The session's only control: end the workout. Styled to match
 * StartWorkoutDock.jsx's "Start workout" button (Dashboard.jsx) rather than
 * the rest of the immersive HUD's tiles — a `liquid-glass` pill wrapped
 * around a solid white, black-icon badge with its own glow, so ending a
 * workout reads as the same "primary action" language as starting one.
 * Icon-only at rest, expanding on hover/focus to reveal the "End Workout"
 * label rather than showing it permanently, so it stays visually quiet
 * until the user's actually reaching for it. `max-w-0 -> max-w-[10rem]` on
 * the label (rather than animating the button's own width) is what makes
 * the reveal slide smoothly instead of snapping — `overflow-hidden` on the
 * label keeps the growing text clipped instead of pushing the pill's
 * layout around mid-transition.
 */
export default function SessionControls({ onEndSession }) {
  return (
    <button
      type="button"
      onClick={onEndSession}
      aria-label="End workout"
      className="group liquid-glass flex items-center overflow-hidden rounded-full p-1.5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] transition-[padding-right] duration-300 hover:pr-5 focus-visible:pr-5"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-900 shadow-[0_0_24px_rgba(255,255,255,0.6)] transition duration-300 group-hover:scale-110 group-hover:shadow-[0_0_36px_rgba(255,255,255,0.85)] group-focus-visible:scale-110">
        <StopIcon />
      </span>
      <span className="max-w-0 overflow-hidden whitespace-nowrap font-rajdhani text-sm font-bold uppercase tracking-wide text-white opacity-0 transition-[max-width,opacity,margin-left] duration-300 group-hover:ml-2 group-hover:max-w-[10rem] group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-[10rem] group-focus-visible:opacity-100">
        End Workout
      </span>
    </button>
  )
}
