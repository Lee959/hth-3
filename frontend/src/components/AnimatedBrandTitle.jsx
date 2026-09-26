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

/**
 * Mimics the accountABLE wordmark (App.jsx's header, LandingNavbar.jsx)
 * but as the landing page's own big title — no liquid-glass card around
 * it here, just the type, per the design brief for this pass.
 */
export default function AnimatedBrandTitle({ className = '' }) {
  return (
    <motion.h1
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.6 }}
      className={`font-rajdhani text-5xl font-bold uppercase tracking-wide text-white md:text-7xl ${className}`}
    >
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
    </motion.h1>
  )
}
