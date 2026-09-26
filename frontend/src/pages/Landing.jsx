import { motion, useScroll } from 'framer-motion'
import { useRef } from 'react'
import { Link } from 'react-router-dom'

import AnimatedBrandTitle from '../components/AnimatedBrandTitle.jsx'
import MetricsMarquee, { MetricsGridStatic } from '../components/MetricsMarquee.jsx'
import PerspectiveImage from '../components/PerspectiveImage.jsx'
import StampedReview from '../components/StampedReview.jsx'
import WaveField from '../components/WaveField.jsx'
import { useAppScrollContainer } from '../hooks/useAppScrollContainer.js'

const BOXER_SRC = '/images/boxer-hero.svg'

const REVIEWS = [
  {
    quote:
      'The rep counter never loses track of me mid-set, and seeing the muscle heatmap light up after a workout is oddly addictive.',
    name: 'Jordan M.',
    role: 'Home gym, 4x/week',
  },
  {
    quote: "No wearable, no chest strap — it reads my heart rate straight off the camera and it's scarily accurate.",
    name: 'Priya K.',
    role: 'Marathon training',
  },
]

const CTA_REVEAL = {
  hidden: { y: 60, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.6, ease: 'easeOut' } },
}

/**
 * The marketing landing page ("/" — see App.jsx). Sits under the app's
 * shared header (no page-specific navbar here; that's App.jsx's job on
 * every non-immersive route), on a black background per this pass's brief.
 *
 * Two parallel layouts, split by the `md:` breakpoint rather than one
 * responsive tree: the desktop version's hero and metrics section each
 * need a tall scroll "track" (multiple viewport-heights) with pinned
 * (`sticky`) content inside it purely to give scroll-linked animations
 * (WaveField.jsx's waves, PerspectiveImage.jsx's tilt, MetricsMarquee.jsx's
 * opposite-direction drift) room to play out — none of that fits a phone
 * screen's scroll budget or motion tolerance, so mobile gets a plain,
 * static, single flowing layout instead (see each component's own doc
 * comment for its specific mobile fallback). `hidden md:block` / `md:hidden`
 * toggles fully remove whichever tree isn't showing, so the tall desktop
 * tracks don't leave a dead scroll gap on mobile.
 */
export default function Landing() {
  const heroRef = useRef(null)
  const scrollContainer = useAppScrollContainer()
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    container: scrollContainer,
    offset: ['start start', 'end start'],
  })

  return (
    <div className="bg-black">
      {/* Hero — desktop */}
      <div ref={heroRef} className="relative hidden h-[220vh] md:block">
        <div className="sticky top-0 flex h-screen flex-col items-center justify-center gap-10 overflow-hidden px-4">
          <WaveField scrollYProgress={heroProgress} />
          <AnimatedBrandTitle className="relative z-10 text-center" />
          <PerspectiveImage scrollYProgress={heroProgress} src={BOXER_SRC} className="relative z-10 w-full max-w-2xl" />
        </div>
      </div>

      {/* Hero — mobile: same title animation (a one-shot viewport trigger,
          not scroll-linked, so it works fine here too), flat image, no
          waves/tilt/tall track. */}
      <div className="flex flex-col items-center gap-6 px-4 pb-10 pt-10 md:hidden">
        <AnimatedBrandTitle className="text-center" />
        <img src={BOXER_SRC} alt="" className="w-full max-w-sm select-none" draggable={false} />
      </div>

      {/* Metrics + reviews — desktop: reviews flank the marquee */}
      <div className="hidden md:grid md:grid-cols-[280px_minmax(0,1fr)_280px] md:items-center md:gap-6 md:px-8 md:py-16">
        <StampedReview {...REVIEWS[0]} />
        <MetricsMarquee />
        <StampedReview {...REVIEWS[1]} />
      </div>

      {/* Metrics + reviews — mobile: stacked, static grid, no drift */}
      <div className="flex flex-col gap-6 px-4 py-12 md:hidden">
        <StampedReview {...REVIEWS[0]} />
        <MetricsGridStatic />
        <StampedReview {...REVIEWS[1]} />
      </div>

      {/* Closing CTA */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.6 }}
        variants={CTA_REVEAL}
        className="px-4 pb-24 pt-4 text-center md:pb-32"
      >
        <Link to="/register" className="group inline-block">
          <span className="font-rajdhani text-2xl font-bold uppercase tracking-wide text-white md:text-4xl">
            Discover the best workout companion{' '}
          </span>
          <span className="relative inline-block font-rajdhani text-2xl font-bold uppercase tracking-wide text-accent-400 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:[text-shadow:0_0_24px_rgba(230,86,89,0.9)] md:text-4xl">
            now
            <span className="absolute inset-x-0 -bottom-1 h-0.5 origin-left scale-x-0 bg-accent-400 transition-transform duration-300 ease-out group-hover:scale-x-100" />
          </span>
        </Link>
      </motion.div>
    </div>
  )
}
