import GlassTile from './GlassTile.jsx'
import { ASSUMED_MAX_HR, HEART_RATE_ZONES as ZONES, zoneForPct } from '../lib/heartRateZones.js'

const SIZE = 100
const CENTER = SIZE / 2
const RADIUS = 42
const STROKE = 8
const START_ANGLE = -135 // degrees, 0 = 12 o'clock, clockwise positive
const END_ANGLE = 135
const SWEEP = END_ANGLE - START_ANGLE // 270deg, leaving a gap at the bottom like a watch face

function pointOnCircle(angleDeg, radius) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) }
}

function arcPath(startAngle, endAngle, radius) {
  const start = pointOnCircle(startAngle, radius)
  const end = pointOnCircle(endAngle, radius)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

/**
 * Garmin-watch-style heart rate dial: a 270° zone-colored arc (resting ->
 * max, blue -> red) with a tick marking the current reading, a zone label,
 * the raw bpm in the center, and a heart icon tinted to the current zone.
 * Heart rate comes from Presage (server-side, polled); `ASSUMED_MAX_HR` is
 * a placeholder until the app has a real user-configured max HR.
 */
export default function HeartRateGauge({ heartRateBpm }) {
  const pct = heartRateBpm ? Math.max(0, Math.min(100, (heartRateBpm / ASSUMED_MAX_HR) * 100)) : null
  const zone = pct != null ? zoneForPct(pct) : null
  const pointerAngle = START_ANGLE + ((pct ?? 0) / 100) * SWEEP
  const pointerOuter = pointOnCircle(pointerAngle, RADIUS + STROKE / 2 + 3)
  const pointerInner = pointOnCircle(pointerAngle, RADIUS - STROKE / 2 - 3)

  return (
    <GlassTile className="flex flex-col items-center gap-1 p-3 text-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {ZONES.map((z, i) => {
            const segStart = START_ANGLE + (i * SWEEP) / ZONES.length
            const segEnd = START_ANGLE + ((i + 1) * SWEEP) / ZONES.length
            return (
              <path
                key={z.label}
                d={arcPath(segStart, segEnd, RADIUS)}
                stroke={z.color}
                strokeWidth={STROKE}
                fill="none"
                strokeLinecap="round"
                opacity={pct == null ? 0.35 : 1}
              />
            )
          })}
          {pct != null && (
            <line
              x1={pointerInner.x}
              y1={pointerInner.y}
              x2={pointerOuter.x}
              y2={pointerOuter.y}
              stroke="white"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-rajdhani text-[10px] font-bold uppercase tracking-wide text-white/70">
            {zone ? zone.label : 'No Data'}
          </span>
          <span className="font-rajdhani text-2xl font-bold leading-none text-white">
            {heartRateBpm ? Math.round(heartRateBpm) : '—'}
          </span>
          <svg viewBox="0 0 24 24" fill={zone ? zone.color : '#6b7280'} className="mt-0.5 h-3 w-3">
            <path d="M12 21s-6.7-4.35-9.3-8.2C1.1 10.6 1.4 7.6 3.6 6 5.4 4.7 7.8 5 9.2 6.6L12 9.8l2.8-3.2c1.4-1.6 3.8-1.9 5.6-.6 2.2 1.6 2.5 4.6.9 6.8C18.7 16.65 12 21 12 21z" />
          </svg>
        </div>
      </div>
      <p className="font-rajdhani text-xs font-bold uppercase tracking-wide text-white">Heart Rate</p>
    </GlassTile>
  )
}
