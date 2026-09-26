import GlassTile from './GlassTile.jsx'

const SIZE = 64
const STROKE = 7
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Circular progress gauge, its own compact square-ish glass tile — ring
 * with the percentage centered inside it, title below, subtitle below that.
 */
export default function GaugeRing({ value, label, sublabel, color = '#5eead4' }) {
  const pct = Math.max(0, Math.min(100, value ?? 0))
  const offset = CIRCUMFERENCE * (1 - pct / 100)

  return (
    <GlassTile className="flex flex-col items-center gap-1 p-3 text-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
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
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-rajdhani text-base font-bold text-white">
            {value == null ? '—' : `${Math.round(pct)}%`}
          </span>
        </div>
      </div>
      <p className="font-rajdhani text-xs font-bold uppercase tracking-wide text-white">{label}</p>
      {sublabel && <p className="font-rajdhani text-[11px] font-light text-white/50">{sublabel}</p>}
    </GlassTile>
  )
}
