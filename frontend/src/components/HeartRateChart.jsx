import { useEffect, useRef, useState } from 'react'

const HEIGHT = 200
const MARGIN = { top: 22, right: 64, bottom: 26, left: 36 }
// Approximates the glass card's surface; rings around dots use it so they
// stay legible where they sit on the line.
const SURFACE = '#1d1724'

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function useWidth(ref) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}

/**
 * Single-series heart-rate line for one workout: 2px line over a 10% wash,
 * hairline gridlines, and only two direct labels (the peak and the final
 * reading). A crosshair snaps to the nearest reading on hover, and the
 * arrow keys walk it when the chart has focus; a visually-hidden table
 * carries every value for screen readers.
 */
export default function HeartRateChart({ points, color = '#f43f5e' }) {
  const wrapRef = useRef(null)
  const width = useWidth(wrapRef)
  const [active, setActive] = useState(null)

  if (!points?.length) return null

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right)
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom
  const maxT = Math.max(points[points.length - 1].t_sec, 1)
  const bpms = points.map((p) => p.bpm)
  const yMin = Math.floor((Math.min(...bpms) - 5) / 20) * 20
  const yMax = Math.ceil((Math.max(...bpms) + 5) / 20) * 20
  const x = (t) => MARGIN.left + (t / maxT) * innerW
  const y = (bpm) => MARGIN.top + (1 - (bpm - yMin) / (yMax - yMin)) * innerH

  const yTicks = []
  for (let v = yMin; v <= yMax; v += 20) yTicks.push(v)
  const minuteStep = maxT / 60 > 30 ? 10 : 5
  const xTicks = []
  for (let m = 0; m * 60 <= maxT; m += minuteStep) xTicks.push(m)

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t_sec)},${y(p.bpm)}`).join('')
  const area = `${line}L${x(maxT)},${y(yMin)}L${x(0)},${y(yMin)}Z`

  const peakIndex = bpms.indexOf(Math.max(...bpms))
  const peak = points[peakIndex]
  const last = points[points.length - 1]
  const hovered = active == null ? null : points[active]

  function nearestIndex(clientX) {
    const rect = wrapRef.current.getBoundingClientRect()
    const t = ((clientX - rect.left - MARGIN.left) / innerW) * maxT
    let best = 0
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i].t_sec - t) < Math.abs(points[best].t_sec - t)) best = i
    }
    return best
  }

  function onKeyDown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const step = event.key === 'ArrowRight' ? 1 : -1
    setActive((i) => Math.max(0, Math.min(points.length - 1, (i ?? (step > 0 ? -1 : points.length)) + step)))
  }

  const tooltipLeft = hovered ? x(hovered.t_sec) : 0
  const flip = tooltipLeft > width - 140

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="group"
      aria-label={`Heart rate over the workout, peaking at ${peak.bpm} bpm and ending at ${last.bpm} bpm`}
      onPointerMove={(e) => width && setActive(nearestIndex(e.clientX))}
      onPointerLeave={() => setActive(null)}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
      className="relative w-full touch-pan-y overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      style={{ height: HEIGHT }}
    >
      {width > 0 && (
        // Absolutely positioned so its measured pixel width never feeds back
        // into the card's size: otherwise, after the screen narrows, the old
        // wide svg holds the whole grid column open and the cards overflow.
        <svg width={width} height={HEIGHT} className="absolute left-0 top-0 block overflow-visible">
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.08)" />
              <text x={MARGIN.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-white/40 font-rajdhani text-[11px] tabular-nums">
                {v}
              </text>
            </g>
          ))}
          {xTicks.map((m) => (
            <text key={m} x={x(m * 60)} y={HEIGHT - 6} textAnchor="middle" className="fill-white/40 font-rajdhani text-[11px] tabular-nums">
              {m}m
            </text>
          ))}

          <path d={area} fill={color} fillOpacity={0.1} />
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* Direct labels: peak and final reading only. */}
          <circle cx={x(peak.t_sec)} cy={y(peak.bpm)} r={4} fill={color} stroke={SURFACE} strokeWidth={2} />
          <text x={x(peak.t_sec)} y={y(peak.bpm) - 10} textAnchor="middle" className="fill-white/70 font-rajdhani text-xs font-semibold">
            Peak {peak.bpm}
          </text>
          <circle cx={x(last.t_sec)} cy={y(last.bpm)} r={4} fill={color} stroke={SURFACE} strokeWidth={2} />
          <text x={x(last.t_sec) + 10} y={y(last.bpm)} dy="0.32em" className="fill-white font-rajdhani text-sm font-bold">
            {last.bpm}
            <tspan className="fill-white/50 text-[11px] font-light"> bpm</tspan>
          </text>

          {hovered && (
            <g pointerEvents="none">
              <line x1={x(hovered.t_sec)} x2={x(hovered.t_sec)} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} stroke="rgba(255,255,255,0.35)" />
              <circle cx={x(hovered.t_sec)} cy={y(hovered.bpm)} r={5} fill={color} stroke={SURFACE} strokeWidth={2} />
            </g>
          )}
        </svg>
      )}

      {hovered && (
        <div
          className="pointer-events-none absolute top-0 whitespace-nowrap rounded-xl border border-white/15 bg-[#1d1724]/90 px-3 py-2 shadow-lg backdrop-blur-md"
          style={{ left: tooltipLeft, transform: `translateX(${flip ? 'calc(-100% - 12px)' : '12px'})` }}
        >
          <p className="font-rajdhani text-base font-bold leading-tight text-white">{hovered.bpm} bpm</p>
          <p className="flex items-center gap-1.5 font-rajdhani text-xs font-light text-white/60">
            <span className="inline-block h-0.5 w-3 rounded-full" style={{ backgroundColor: color }} />
            {formatElapsed(hovered.t_sec)} into workout
          </p>
        </div>
      )}

      {/* The wrapper does the hiding: a <table> ignores the 1px box that
          sr-only relies on and would still stretch the scroll area. */}
      <div className="sr-only">
        <table>
          <caption>Heart rate readings</caption>
          <thead>
            <tr>
              <th scope="col">Time into workout</th>
              <th scope="col">Heart rate (bpm)</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.t_sec}>
                <td>{formatElapsed(p.t_sec)}</td>
                <td>{p.bpm}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
