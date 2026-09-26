import { useState } from 'react'

// One hue, dim -> bright as intensity rises (validated as an ordinal ramp
// against the dark glass surface). Zone ranges mirror the backend's
// services/effort.py.
const ZONES = [
  { name: 'Zone 1', range: '50–60%', color: '#823046' },
  { name: 'Zone 2', range: '60–70%', color: '#a8354f' },
  { name: 'Zone 3', range: '70–80%', color: '#cc3a5a' },
  { name: 'Zone 4', range: '80–90%', color: '#f43f5e' },
  { name: 'Zone 5', range: '90%+', color: '#fb8fa1' },
]

function formatMinutes(m) {
  return m >= 10 ? `${Math.round(m)} min` : `${Math.round(m * 10) / 10} min`
}

/**
 * Time in each heart-rate zone as one stacked bar (2px surface gaps between
 * segments, per-segment hover/focus readout) plus a legend that carries
 * the minutes, so nothing depends on hovering or on telling colors apart.
 */
export default function ZoneBar({ minutes }) {
  const [active, setActive] = useState(null)
  const total = minutes.reduce((a, b) => a + b, 0)
  if (!total) return null

  return (
    <div>
      <div className="relative">
        <div className="flex h-3 gap-0.5 overflow-hidden rounded">
          {ZONES.map((zone, i) =>
            minutes[i] > 0 ? (
              <span
                key={zone.name}
                tabIndex={0}
                aria-label={`${zone.name} (${zone.range} of max): ${formatMinutes(minutes[i])}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="h-full outline-none transition-[filter] focus-visible:brightness-125"
                style={{
                  flexGrow: minutes[i],
                  backgroundColor: zone.color,
                  filter: active === i ? 'brightness(1.25)' : undefined,
                }}
              />
            ) : null,
          )}
        </div>
        {active != null && (
          <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-white/15 bg-[#1d1724]/90 px-2.5 py-1.5 shadow-lg backdrop-blur-md">
            <p className="font-rajdhani text-sm font-bold leading-tight text-white">{formatMinutes(minutes[active])}</p>
            <p className="font-rajdhani text-[11px] font-light text-white/60">
              {ZONES[active].name} · {ZONES[active].range} of max
            </p>
          </div>
        )}
      </div>
      <ul className="mt-3 grid grid-cols-5 gap-1">
        {ZONES.map((zone, i) => (
          <li key={zone.name} className="font-rajdhani leading-tight">
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: zone.color }} />Z{i + 1}
            </span>
            <span className="text-xs font-bold text-white/80">{Math.round(minutes[i])}m</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
