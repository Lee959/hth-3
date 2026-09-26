import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

import GaugeRing from './GaugeRing.jsx'
import HeartRateChart from './HeartRateChart.jsx'
import HeartRateGauge from './HeartRateGauge.jsx'
import ScoreRing from './ScoreRing.jsx'
import Sparkline from './Sparkline.jsx'
import StatTile from './StatTile.jsx'
import { useAppScrollContainer } from '../hooks/useAppScrollContainer.js'

// Keep in sync with the panel's Tailwind size (w-56 = 14rem) and the row's
// gap (gap-6 = 1.5rem), at the default 16px root — these drive the
// marquee's translate distance below, so the loop point lines up exactly
// with where the duplicated set starts.
const PANEL_PX = 224
const GAP_PX = 24
const SET_WIDTH = PANEL_PX * 3 + GAP_PX * 2

// All placeholder data — this is a marketing preview, not a live session.
const HEART_RATE_BPM = 128
const BREATHING_RPM = 15
const ACTIVE_MINUTES = 42
const REP_GOAL_PCT = 72
const HR_POINTS = Array.from({ length: 24 }, (_, i) => ({
  t_sec: i * 25,
  bpm: 105 + Math.round(18 * Math.sin(i / 3) + (i > 18 ? (i - 18) * 2.5 : 0)),
}))
const FORM_SCORE = 83
const FORM_TREND = [62, 68, 71, 75, 74, 79, 83].map((score, i) => ({
  score,
  session_id: i,
  started_at: `2026-0${(i % 9) + 1}-01T00:00:00Z`,
}))

function Panel({ glass = true, children }) {
  return (
    <div
      style={{ width: PANEL_PX, height: PANEL_PX }}
      className={`flex shrink-0 items-center justify-center ${glass ? 'liquid-glass rounded-3xl p-4' : ''}`}
    >
      {children}
    </div>
  )
}

function Row({ items, x }) {
  // Rendered twice back to back so translating by exactly one set's width
  // loops seamlessly — the second copy lines up pixel-for-pixel where the
  // first one started.
  return (
    <motion.div className="flex gap-6" style={{ x, width: SET_WIDTH * 2 }}>
      {[...items, ...items].map((item, i) => (
        <Panel key={i} glass={item.glass}>
          {item.content}
        </Panel>
      ))}
    </motion.div>
  )
}

const TOP_ROW = [
  { glass: false, content: <HeartRateGauge heartRateBpm={HEART_RATE_BPM} /> },
  {
    content: (
      <div className="flex h-full w-full flex-col items-center justify-center">
        <StatTile label="Respiration" value={BREATHING_RPM} unit="rpm" />
      </div>
    ),
  },
  {
    content: (
      <div className="flex h-full w-full flex-col gap-2">
        <p className="font-rajdhani text-xs font-bold uppercase tracking-[0.18em] text-white/60">Heart rate</p>
        <div className="flex-1">
          <HeartRateChart points={HR_POINTS} color="#E65659" />
        </div>
      </div>
    ),
  },
]

const BOTTOM_ROW = [
  { glass: false, content: <GaugeRing value={REP_GOAL_PCT} label="Rep goal" sublabel="18 / 25 reps" color="#E65659" /> },
  {
    content: (
      <div className="flex h-full w-full flex-col items-center justify-center">
        <StatTile label="Active time" value={ACTIVE_MINUTES} unit="min" />
      </div>
    ),
  },
  {
    content: (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3">
        <p className="font-rajdhani text-xs font-bold uppercase tracking-[0.18em] text-white/60">Form score</p>
        <ScoreRing value={FORM_SCORE} color="#10a898" size={72} stroke={7} caption="Improving" />
        <Sparkline points={FORM_TREND} color="#10a898" label="Form score" />
      </div>
    ),
  },
]

/**
 * Mobile fallback: the same 6 panels (unduplicated) as a plain static
 * 2-column grid, no scroll track, no drift — a phone screen doesn't have
 * room for two independently-scrolling rows plus a tilting hero image plus
 * animated waves all at once, so the drift motion is dropped here in favor
 * of just showing the content (see Landing.jsx for the md: breakpoint
 * split between this and MetricsMarquee itself).
 */
export function MetricsGridStatic() {
  return (
    <div className="mx-auto grid max-w-md grid-cols-2 gap-4 px-4">
      {[...TOP_ROW, ...BOTTOM_ROW].map((item, i) => (
        <div
          key={i}
          // Not aspect-square: the chart panels (HeartRateChart's fixed
          // 200px HEIGHT, Sparkline+ScoreRing stacked) are naturally taller
          // than the stat/gauge ones, and forcing a square clipped them —
          // letting each cell size to its own content keeps every panel
          // fully visible, at the cost of the row heights no longer
          // matching exactly.
          className={`flex min-h-[180px] items-center justify-center ${item.glass === false ? '' : 'liquid-glass rounded-3xl p-4'}`}
        >
          {item.content}
        </div>
      ))}
    </div>
  )
}

/**
 * The landing page's metrics preview: 3x2 liquid-glass panels of the app's
 * real HUD/dashboard widgets (all placeholder data — see the constants
 * above), reused as-is rather than rebuilt (HeartRateGauge.jsx and
 * GaugeRing.jsx already carry their own glass tile, so their Panel skips
 * adding a second one; the rest are bare components that get Panel's).
 *
 * The top and bottom rows drift in opposite directions as the page
 * scrolls — this is a scroll-tied *drift*, not a self-looping marquee: it
 * only moves while the user is scrolling through this section, driven by
 * useScroll's scrollYProgress against a tall track (`SCROLL_TRACK`) with
 * the visible content pinned via `sticky` inside it (same pattern as the
 * old scroll-scrubbed video section) so there's enough scroll distance to
 * drive a real horizontal travel despite the pinned content itself only
 * being about a third of the viewport tall.
 */
export default function MetricsMarquee() {
  const trackRef = useRef(null)
  const scrollContainer = useAppScrollContainer()
  const { scrollYProgress } = useScroll({
    target: trackRef,
    container: scrollContainer,
    offset: ['start start', 'end end'],
  })
  const topX = useTransform(scrollYProgress, [0, 1], [0, -SET_WIDTH])
  const bottomX = useTransform(scrollYProgress, [0, 1], [-SET_WIDTH, 0])

  return (
    <div ref={trackRef} className="relative h-[250vh]">
      {/* Pinned viewport is ~1/3 of the screen tall (min-h keeps both rows
          clear of each other on short viewports) and exactly SET_WIDTH
          wide, mx-auto centered — at scroll progress 0 that width shows
          exactly one full (unduplicated) set of 3 panels, so the section
          reads as a clean, centered 3x2 grid before it starts drifting. */}
      <div className="sticky top-0 flex h-[36vh] min-h-[480px] flex-col items-center justify-center gap-6">
        <div className="overflow-hidden" style={{ width: SET_WIDTH }}>
          <Row items={TOP_ROW} x={topX} />
        </div>
        <div className="overflow-hidden" style={{ width: SET_WIDTH }}>
          <Row items={BOTTOM_ROW} x={bottomX} />
        </div>
      </div>
    </div>
  )
}
