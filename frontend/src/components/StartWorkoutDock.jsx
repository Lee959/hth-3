import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

// Pointer zone (px) around the bottom-center of the screen that reveals the
// button. Once shown, a larger zone keeps it up, so the edge of the zone
// doesn't flicker it in and out.
const SHOW_ZONE = { halfWidth: 200, height: 130 }
const KEEP_ZONE = { halfWidth: 280, height: 200 }
const HIDE_DELAY_MS = 300

function inZone(event, zone) {
  return (
    event.clientY >= window.innerHeight - zone.height &&
    Math.abs(event.clientX - window.innerWidth / 2) <= zone.halfWidth
  )
}

// Hide-on-idle only makes sense with a mouse; on touch screens there's no
// pointer to bring near the bottom, so the button just stays out.
function useCanHover() {
  const query = '(hover: hover) and (pointer: fine)'
  const [canHover, setCanHover] = useState(() => window.matchMedia?.(query).matches ?? true)
  useEffect(() => {
    const mql = window.matchMedia?.(query)
    if (!mql) return undefined
    const onChange = () => setCanHover(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return canHover
}

function PlayIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`ml-0.5 ${className}`}>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function ChevronUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M6 15l6-6 6 6" />
    </svg>
  )
}

/**
 * The home page's "Start workout" button, docked at the bottom middle of
 * the screen (the same spot the session screen keeps its controls).
 *
 * With a mouse, it tucks away below the edge and leaves a small glowing
 * hint tab in its place; bringing the pointer near the bottom center slides
 * the full button up, and it tucks away again once the pointer leaves.
 * Tabbing to the hint (or clicking it) reveals it too, and it stays up while
 * it has keyboard focus. On touch screens it's always shown.
 */
export default function StartWorkoutDock() {
  const canHover = useCanHover()
  const [revealed, setRevealed] = useState(false)
  const hideTimer = useRef(null)
  const dockRef = useRef(null)
  const shown = !canHover || revealed

  useEffect(() => {
    if (!canHover) return undefined
    function onMouseMove(event) {
      const hasFocus = dockRef.current?.contains(document.activeElement)
      setRevealed((isShown) => {
        const inside = inZone(event, isShown ? KEEP_ZONE : SHOW_ZONE)
        if (inside || hasFocus) {
          clearTimeout(hideTimer.current)
          hideTimer.current = null
          return true
        }
        if (isShown && hideTimer.current == null) {
          hideTimer.current = setTimeout(() => {
            hideTimer.current = null
            setRevealed(false)
          }, HIDE_DELAY_MS)
        }
        return isShown
      })
    }
    // Pointer leaving the window from the bottom edge shouldn't strand it open.
    function onMouseLeaveWindow() {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
      if (!dockRef.current?.contains(document.activeElement)) setRevealed(false)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.documentElement.addEventListener('mouseleave', onMouseLeaveWindow)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.documentElement.removeEventListener('mouseleave', onMouseLeaveWindow)
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [canHover])

  function onBlur(event) {
    if (!dockRef.current?.contains(event.relatedTarget)) setRevealed(false)
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      setRevealed(false)
      document.activeElement?.blur()
    }
  }

  return (
    <div
      ref={dockRef}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4"
      style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
    >
      {/* Hint: a small glowing play orb where the button will appear, with
          an up-arrow nudging above it and a slowly breathing glow behind —
          easy to spot, but a fraction of the button's size. Slides away as
          the real button rises. */}
      {canHover && (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          onFocus={() => setRevealed(true)}
          aria-label="Show start workout button"
          title="Start workout"
          tabIndex={shown ? -1 : 0}
          className={`group absolute left-1/2 flex -translate-x-1/2 flex-col items-center rounded-full transition duration-300 focus-visible:outline-none ${
            shown ? 'pointer-events-none translate-y-[150%] opacity-0' : 'pointer-events-auto translate-y-0 opacity-100'
          }`}
          style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <span className="animate-hint-nudge mb-0.5 text-white/90">
            <ChevronUpIcon />
          </span>
          <span className="relative">
            <span
              aria-hidden="true"
              className="animate-hint-breathe absolute -inset-3 rounded-full bg-gradient-to-r from-rose-500/70 via-fuchsia-500/60 to-teal-400/60 blur-lg"
            />
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow-[0_0_24px_rgba(255,255,255,0.7)] ring-4 ring-white/15 transition group-hover:scale-110 group-focus-visible:ring-white/60 motion-reduce:group-hover:scale-100">
              <PlayIcon className="h-4 w-4" />
            </span>
          </span>
        </button>
      )}

      {/* Hover/focus: the button grows ~5% with a slight spring overshoot
          while the halo behind it blooms wider and brighter. Reduced motion
          keeps the glow change but drops the movement. */}
      <Link
        to="/session"
        tabIndex={shown ? 0 : -1}
        aria-hidden={!shown}
        onFocus={() => setRevealed(true)}
        className={`group relative rounded-full transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] focus-visible:outline-none motion-reduce:transition-opacity ${
          shown
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-[calc(100%+2rem)] opacity-0 motion-reduce:translate-y-0'
        }`}
      >
        <span
          aria-hidden="true"
          className="absolute -inset-5 rounded-full bg-gradient-to-r from-rose-500/40 via-fuchsia-500/30 to-teal-400/30 opacity-70 blur-2xl transition-[opacity,transform,filter] duration-500 ease-out group-hover:scale-125 group-hover:opacity-100 group-hover:blur-3xl group-hover:saturate-150 group-focus-visible:scale-125 group-focus-visible:opacity-100 group-focus-visible:blur-3xl motion-reduce:group-hover:scale-100 motion-reduce:group-focus-visible:scale-100"
        />
        <span className="liquid-glass relative flex items-center gap-4 rounded-full py-2.5 pl-2.5 pr-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-1 group-hover:scale-105 group-hover:border-white/35 group-hover:shadow-[0_24px_60px_-10px_rgba(0,0,0,0.85),0_0_40px_-6px_rgba(244,63,94,0.55)] group-focus-visible:-translate-y-1 group-focus-visible:scale-105 group-focus-visible:border-white/60 motion-reduce:group-hover:translate-y-0 motion-reduce:group-hover:scale-100 motion-reduce:group-focus-visible:translate-y-0 motion-reduce:group-focus-visible:scale-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-900 shadow-[0_0_30px_rgba(255,255,255,0.45)] transition duration-300 group-hover:scale-110 group-hover:shadow-[0_0_44px_rgba(255,255,255,0.75)] group-focus-visible:scale-110 motion-reduce:group-hover:scale-100 motion-reduce:group-focus-visible:scale-100">
            <PlayIcon className="h-6 w-6" />
          </span>
          <span className="whitespace-nowrap font-rajdhani text-lg font-bold uppercase tracking-[0.15em] text-white">
            Start workout
          </span>
        </span>
      </Link>
    </div>
  )
}
