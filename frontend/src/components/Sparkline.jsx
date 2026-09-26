import { useState } from 'react'

const WIDTH = 160
const HEIGHT = 40
const PAD = 5
// Approximates the glass card surface, for the ring around dots.
const SURFACE = '#1d1724'

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''
}

/**
 * Per-workout score trend, oldest to newest: earlier workouts in a dim
 * de-emphasis line, the latest point marked in the accent. Hover (or
 * focus + arrow keys) reads out any workout's score and date.
 */
export default function Sparkline({ points, color, label }) {
  const [active, setActive] = useState(null)
  if (!points || points.length < 2) return null

  const scores = points.map((p) => p.score)
  const lo = Math.min(...scores)
  const hi = Math.max(...scores)
  const x = (i) => PAD + (i / (points.length - 1)) * (WIDTH - PAD * 2)
  const y = (v) => (hi === lo ? HEIGHT / 2 : PAD + (1 - (v - lo) / (hi - lo)) * (HEIGHT - PAD * 2))
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.score)}`).join('')
  const last = points.length - 1
  const shown = active ?? last

  function onPointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    setActive(Math.max(0, Math.min(last, Math.round(ratio * last))))
  }

  function onKeyDown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const step = event.key === 'ArrowRight' ? 1 : -1
    setActive((i) => Math.max(0, Math.min(last, (i ?? last) + step)))
  }

  return (
    <div className="flex items-end gap-3">
      <div
        tabIndex={0}
        role="group"
        aria-label={`${label} over the last ${points.length} workouts`}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <svg width={WIDTH} height={HEIGHT} className="block overflow-visible" aria-hidden="true">
          <path d={path} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {active != null && (
            <line x1={x(active)} x2={x(active)} y1={0} y2={HEIGHT} stroke="rgba(255,255,255,0.25)" />
          )}
          <circle cx={x(shown)} cy={y(points[shown].score)} r={4} fill={color} stroke={SURFACE} strokeWidth={2} />
        </svg>
        <ul className="sr-only">
          {points.map((p) => (
            <li key={p.session_id ?? p.started_at}>
              {formatDate(p.started_at)}: {Math.round(p.score)}
            </li>
          ))}
        </ul>
      </div>
      <p className="min-w-[4.5rem] font-rajdhani leading-tight" aria-live="polite">
        <span className="block text-sm font-bold text-white">{Math.round(points[shown].score)}</span>
        <span className="block text-[11px] font-light text-white/50">
          {active == null || active === last ? 'Latest' : formatDate(points[shown].started_at)}
        </span>
      </p>
    </div>
  )
}
