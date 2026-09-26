/**
 * Large 0-100 score meter: the arc's fill carries the score, the track is
 * a faint step of the same hue, and the number sits in the middle in text
 * ink (never the data color). `caption` goes under the number, e.g. a
 * rating word like "Good".
 *
 * Hovering it spotlights the score: a soft glow in the ring's color fades
 * in behind it, the arc glows and its track brightens, and the whole ring
 * lifts with the same springy "pop" as the Start/End workout buttons
 * (StartWorkoutDock.jsx, SessionControls.jsx).
 */
export default function ScoreRing({ value, color, size = 124, stroke = 10, caption }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value))

  return (
    <div className="group relative shrink-0" style={{ width: size, height: size, '--ring-color': color }}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-5 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-60"
        style={{ background: `radial-gradient(closest-side, ${color}, transparent)` }}
      />
      <div className="relative h-full w-full transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-105 motion-reduce:group-hover:scale-100">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90 transition-[filter] duration-300 group-hover:drop-shadow-[0_0_8px_var(--ring-color)]"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            className="transition-[stroke-opacity] duration-300 [stroke-opacity:0.15] group-hover:[stroke-opacity:0.3]"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct / 100)}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-rajdhani text-4xl font-bold leading-none text-white">
            {value == null ? '—' : Math.round(value)}
          </span>
          {caption && (
            <span className="mt-1 font-rajdhani text-xs font-semibold uppercase tracking-[0.15em] text-white/60 transition-colors duration-300 group-hover:text-white/90">
              {caption}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
