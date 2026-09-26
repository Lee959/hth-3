import { motion } from 'framer-motion'

// A "stamp" entrance: oversized, then springs down to its resting size with
// the same under-damped overshoot feel as AnimatedBrandTitle.jsx's "ABLE"
// slam — the brief for these asked for "the same fashion as the title,"
// which for a review card reads as this spring-driven drop (no rotation —
// these sit flat, unlike an earlier pass that tilted them).
const STAMP = {
  hidden: { scale: 1.6, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
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
      className={`liquid-glass flex flex-col gap-3 rounded-3xl p-4 ${className}`}
    >
      <p className="font-rajdhani text-sm font-light leading-snug text-white/80">“{quote}”</p>
      <div>
        <p className="font-rajdhani text-xs font-bold uppercase tracking-wide text-white">{name}</p>
        <p className="font-rajdhani text-[11px] font-light text-white/50">{role}</p>
      </div>
    </motion.div>
  )
}
