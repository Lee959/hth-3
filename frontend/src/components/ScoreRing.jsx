/**
 * Large 0-100 score meter: the arc's fill carries the score, the track is
 * a faint step of the same hue, and the number sits in the middle in text
 * ink (never the data color). `caption` goes under the number, e.g. a
 * rating word like "Good".
 */
export default function ScoreRing({ value, color, size = 124, stroke = 10, caption }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value))

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={stroke} />
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
          <span className="mt-1 font-rajdhani text-xs font-semibold uppercase tracking-[0.15em] text-white/60">
            {caption}
          </span>
        )}
      </div>
    </div>
  )
}
