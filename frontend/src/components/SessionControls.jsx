function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

/**
 * The session's only control: end the workout. Its own small glass pill,
 * floating at the bottom-middle of the session screen — icon-only at rest,
 * expanding on hover/focus to reveal the "End Workout" label rather than
 * showing it permanently, so it stays visually quiet until the user's
 * actually reaching for it. `max-w-0 -> max-w-[10rem]` on the label
 * (rather than animating the button's own width) is what makes the reveal
 * slide smoothly instead of snapping — `overflow-hidden` on both the
 * button and the label keep the growing text clipped instead of pushing
 * the pill's layout around mid-transition.
 */
export default function SessionControls({ onEndSession }) {
  return (
    <button
      type="button"
      onClick={onEndSession}
      aria-label="End workout"
      className="group flex items-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-3 text-white shadow-lg backdrop-blur-xl transition-colors hover:bg-white/20 focus-visible:bg-white/20"
    >
      <StopIcon />
      <span className="max-w-0 overflow-hidden whitespace-nowrap font-rajdhani text-sm font-bold uppercase tracking-wide opacity-0 transition-[max-width,opacity,margin-left] duration-300 group-hover:ml-2 group-hover:max-w-[10rem] group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-[10rem] group-focus-visible:opacity-100">
        End Workout
      </span>
    </button>
  )
}
