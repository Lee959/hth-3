import { motion } from 'framer-motion'

// A "stamp" entrance: oversized and rotated, then springs down to its
// resting size/angle with the same under-damped overshoot feel as
// AnimatedBrandTitle.jsx's "ABLE" slam — the brief for these asked for
// "the same fashion as the title," which for a review card reads as this
// spring-driven, slightly-off-kilter drop rather than the title's literal
// slide-then-underline (there's no second word to underline here).
const STAMP = {
  hidden: { scale: 1.6, opacity: 0, rotate: -8 },
  visible: {
    scale: 1,
    opacity: 1,
    rotate: -2,
    transition: { type: 'spring', stiffness: 260, damping: 16, mass: 0.9 },
  },
}

export default function StampedReview({ quote, name, role, className = '' }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.5 }}
      variants={STAMP}
      className={`liquid-glass flex flex-col gap-4 rounded-3xl p-6 ${className}`}
    >
      <p className="font-rajdhani text-lg font-light leading-snug text-white/80">“{quote}”</p>
      <div>
        <p className="font-rajdhani text-sm font-bold uppercase tracking-wide text-white">{name}</p>
        <p className="font-rajdhani text-xs font-light text-white/50">{role}</p>
      </div>
    </motion.div>
  )
}
