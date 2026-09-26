import { useLayoutEffect, useRef, useState } from 'react'

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
 *
 * The readout centers over whichever segment is hovered or focused, with a
 * small arrow pointing at it, and slides inward rather than spilling past
 * the bar's ends when that segment sits near an edge.
 */
export default function ZoneBar({ minutes }) {
  // { index, center }: the hovered zone and its segment's midpoint (px from
  // the bar's left edge).
  const [active, setActive] = useState(null)
  const barRef = useRef(null)
  const tipRef = useRef(null)
  const [tipLeft, setTipLeft] = useState(0)

  // Once the readout has rendered (so its width is known), clamp it inside
  // the bar while keeping it as close to centered on the segment as it can.
  useLayoutEffect(() => {
    if (!active || !tipRef.current || !barRef.current) return
    const tipWidth = tipRef.current.offsetWidth
    const barWidth = barRef.current.offsetWidth
    setTipLeft(Math.max(0, Math.min(active.center - tipWidth / 2, barWidth - tipWidth)))
  }, [active])

  const total = minutes.reduce((a, b) => a + b, 0)
  if (!total) return null

  function activate(index, segment) {
    setActive({ index, center: segment.offsetLeft + segment.offsetWidth / 2 })
  }

  return (
    <div>
      <div ref={barRef} className="relative">
        <div className="flex h-3 gap-0.5 overflow-hidden rounded">
          {ZONES.map((zone, i) =>
            minutes[i] > 0 ? (
              <span
                key={zone.name}
                tabIndex={0}
                aria-label={`${zone.name} (${zone.range} of max): ${formatMinutes(minutes[i])}`}
                onPointerEnter={(e) => activate(i, e.currentTarget)}
                onPointerLeave={() => setActive(null)}
                onFocus={(e) => activate(i, e.currentTarget)}
                onBlur={() => setActive(null)}
                className="h-full outline-none transition-[filter] focus-visible:brightness-125"
                style={{
                  flexGrow: minutes[i],
                  backgroundColor: zone.color,
                  filter: active?.index === i ? 'brightness(1.25)' : undefined,
                }}
              />
            ) : null,
          )}
        </div>
        {active && (
          <div
            ref={tipRef}
            className="pointer-events-none absolute -top-2.5 -translate-y-full whitespace-nowrap rounded-lg border border-white/15 bg-[#1d1724]/90 px-2.5 py-1.5 shadow-lg backdrop-blur-md"
            style={{ left: tipLeft }}
          >
            <p className="font-rajdhani text-sm font-bold leading-tight text-white">
              {formatMinutes(minutes[active.index])}
            </p>
            <p className="font-rajdhani text-[11px] font-light text-white/60">
              {ZONES[active.index].name} · {ZONES[active.index].range} of max
            </p>
            {/* Arrow pointing down at the segment's midpoint. */}
            <span
              aria-hidden="true"
              className="absolute top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-white/15 bg-[#1d1724]"
              style={{ left: active.center - tipLeft }}
            />
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
