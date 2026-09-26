const SIZE = 96
const STROKE = 10
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Circular progress ring, styled after the "Liquid Glass" dashboard gauges. */
export default function GaugeRing({ value, label, sublabel, color = '#5eead4' }) {
  const pct = Math.max(0, Math.min(100, value ?? 0))
  const offset = CIRCUMFERENCE * (1 - pct / 100)

  return (
    <div className="flex items-center gap-3">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div>
        <p className="text-xl font-bold leading-none text-white">
          {value == null ? '—' : `${Math.round(pct)}%`}
        </p>
        <p className="mt-1 text-sm font-medium text-white/90">{label}</p>
        {sublabel && <p className="text-xs text-white/50">{sublabel}</p>}
      </div>
    </div>
  )
}
