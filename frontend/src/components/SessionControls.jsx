function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

function ControlButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
    >
      {icon}
    </button>
  )
}

/**
 * Standalone pause/reset/end control strip — its own small glass rectangle,
 * flat vector icons only (no text labels), floating at the bottom-middle of
 * the session screen. `title`/`aria-label` carry the label for screen
 * readers and mouse-hover instead of visible text.
 */
export default function SessionControls({ isPaused, onTogglePause, onReset, onEndSession }) {
  return (
    <div className="flex gap-2 rounded-2xl border border-white/20 bg-white/10 p-2 shadow-lg backdrop-blur-xl">
      <ControlButton icon={<ResetIcon />} label="Reset" onClick={onReset} />
      <ControlButton
        icon={isPaused ? <PlayIcon /> : <PauseIcon />}
        label={isPaused ? 'Resume' : 'Pause'}
        onClick={onTogglePause}
      />
      <ControlButton icon={<StopIcon />} label="End session" onClick={onEndSession} />
    </div>
  )
}
