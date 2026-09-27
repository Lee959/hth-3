import { motion } from 'framer-motion'

// "account" eases in from the left; "ABLE" flies in from the right and
// slams into place with an overshoot (a springy, under-damped transition
// rather than an eased one — the bounce is the "slam"), then an underline
// draws in under it once it's settled. All of it fires once, the first
// time the title scrolls into view (see the h1's whileInView/viewport
// below) — this is an entrance animation, not something tied continuously
// to scroll position like WaveField.jsx/PerspectiveImage.jsx are.
const ACCOUNT = {
  hidden: { x: -140, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { duration: 0.55, ease: 'easeOut' } },
}

const ABLE = {
  hidden: { x: 220, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { delay: 0.45, type: 'spring', stiffness: 480, damping: 14, mass: 0.9 },
  },
}

const UNDERLINE = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: { delay: 1.05, duration: 0.3, ease: 'easeOut' } },
}

// Settles in after the underline finishes (1.05s delay + 0.3s duration).
const SUBTITLE = {
  hidden: { y: 16, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { delay: 1.2, duration: 0.5, ease: 'easeOut' } },
}

/**
 * Mimics the accountABLE wordmark (App.jsx's header, LandingNavbar.jsx)
 * but as the landing page's own big title — no liquid-glass card around
 * it here, just the type, per the design brief for this pass. The
 * `whileInView`/`viewport` trigger lives on the wrapping div (not the
 * `<h1>` directly) so an optional `subtitle` can share the same one-shot
 * reveal via its own variants, timed to land after the title settles.
 * `text-[3.6rem]`/`md:text-[5.4rem]` are `text-5xl`/`text-7xl` scaled up
 * 20% (3rem/4.5rem -> 3.6rem/5.4rem) — Tailwind has no built-in step
 * between `text-7xl` (4.5rem) and `text-8xl` (6rem) that lands on +20%.
 */
export default function AnimatedBrandTitle({ className = '', subtitle }) {
  return (
    <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.6 }} className={className}>
      <h1 className="font-rajdhani text-[3.6rem] font-bold leading-none tracking-wide text-white md:text-[5.4rem]">
        <motion.span variants={ACCOUNT} className="inline-block">
          account
        </motion.span>
        <motion.span variants={ABLE} className="relative inline-block text-accent-400">
          ABLE
          <motion.span
            aria-hidden="true"
            variants={UNDERLINE}
            className="absolute inset-x-0 -bottom-1 h-1.5 origin-left bg-accent-400 md:-bottom-2"
          />
        </motion.span>
      </h1>
      {subtitle && (
        <motion.p
          variants={SUBTITLE}
          className="mx-auto mt-4 max-w-xl font-rajdhani text-lg font-light text-white/70 md:mt-5 md:text-2xl"
        >
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  )
}
