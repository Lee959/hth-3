import { motion, useMotionTemplate, useTransform } from 'framer-motion'

// 5 stacked sine-wave strokes, each a different opacity/thickness/vertical
// offset/phase so they don't all trace on top of each other. Same accent
// pink for every wave — only weight and opacity vary, per the brief.
const WAVES = [
  { y: 90, amplitude: 34, cycles: 2.2, phase: 0, opacity: 0.9, width: 4 },
  { y: 160, amplitude: 46, cycles: 1.6, phase: 0.6, opacity: 0.65, width: 3 },
  { y: 230, amplitude: 28, cycles: 2.8, phase: 1.3, opacity: 0.45, width: 2.5 },
  { y: 300, amplitude: 52, cycles: 1.3, phase: 2.1, opacity: 0.3, width: 5 },
  { y: 370, amplitude: 38, cycles: 2.0, phase: 0.9, opacity: 0.2, width: 2 },
]

const VIEW_W = 1200
const VIEW_H = 460
const SAMPLES = 120

function wavePath({ y, amplitude, cycles, phase }) {
  const points = []
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const x = t * VIEW_W
    const yy = y + Math.sin(t * Math.PI * 2 * cycles + phase) * amplitude
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${yy.toFixed(1)}`)
  }
  return points.join(' ')
}

function Wave({ config, scrollYProgress, index }) {
  const d = wavePath(config)
  // Staggered per wave so they don't all draw in lockstep — the effect
  // reads as 5 independent waves, not one line copy-pasted 5 times.
  const start = index * 0.06
  const drawnIn = start + 0.4
  const drawnOut = 1

  // 0 -> 1 -> 0: hidden, then fully drawn (traced left to right via
  // pathLength/dashoffset), then erased again — "drawn in and then out".
  const pathLength = useTransform(scrollYProgress, [start, drawnIn, drawnOut], [0, 1, 0])
  // Motion blur only on the way in: high right as the line starts
  // tracing, settling to 0 once it's fully drawn; 0 again on the way out
  // (a crisp line disappearing reads cleaner than a blurry one).
  const blur = useTransform(scrollYProgress, [start, drawnIn, drawnIn + 0.001, drawnOut], [6, 0, 0, 0])
  const filter = useMotionTemplate`blur(${blur}px)`

  return (
    <motion.path
      d={d}
      fill="none"
      stroke="#E65659"
      strokeWidth={config.width}
      strokeLinecap="round"
      opacity={config.opacity}
      style={{ pathLength, filter }}
    />
  )
}

/**
 * The landing hero's backdrop: 5 pink sine-wave strokes that trace on
 * (left to right, with a motion-blur trail) and then erase again as the
 * user scrolls through the hero section. `scrollYProgress` is a single
 * motion value Landing.jsx computes once (via useScroll scoped to the
 * hero wrapper) and passes to both this component and PerspectiveImage.jsx,
 * so the waves and the image's tilt stay perfectly in sync — two
 * independent useScroll calls against slightly different refs would drift.
 */
export default function WaveField({ scrollYProgress, className = '' }) {
  // Confined to the lower band of the hero (not a full inset-0) so the
  // waves trace behind/around the boxer image but never cross through the
  // title, which now lives up near the top of the sticky hero instead of
  // dead center — see Landing.jsx.
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-[65%] overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" className="h-full w-full">
        {WAVES.map((config, index) => (
          <Wave key={index} config={config} scrollYProgress={scrollYProgress} index={index} />
        ))}
      </svg>
    </div>
  )
}
