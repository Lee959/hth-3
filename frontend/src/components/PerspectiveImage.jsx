import { motion, useTransform } from 'framer-motion'

/**
 * The hero image (the boxer SVG, sitting right below the title): tilts on
 * a vertical axis as the user scrolls through the hero, via the same
 * `scrollYProgress` motion value WaveField.jsx animates off of (see
 * Landing.jsx, where it's computed once and passed to both) — so the tilt
 * and the waves move together, not independently.
 *
 * `perspective` lives on the wrapper (a plain CSS property, not animated)
 * so the rotated child gets real 3D foreshortening for free: at
 * `rotateY(0)` it's flat-on, and as `rotateY` swings *negative* the LEFT
 * edge rotates away from the viewer (recedes, reads smaller) while the
 * RIGHT edge rotates toward the viewer (comes forward, reads bigger) —
 * exactly the "left goes back, right comes closer" effect asked for. No
 * manual scale/size juggling needed; that foreshortening is just what
 * `perspective` + `rotateY` does to a planar element. (Checked against the
 * actual rotation matrix, not just assumed — a *positive* angle here does
 * the opposite: left forward/bigger, right back/smaller.)
 */
export default function PerspectiveImage({ scrollYProgress, src, alt = '', className = '' }) {
  const rotateY = useTransform(scrollYProgress, [0, 1], [0, -22])

  return (
    <div className={`[perspective:1200px] ${className}`}>
      <motion.img
        src={src}
        alt={alt}
        style={{ rotateY, opacity: 0.7, transformStyle: 'preserve-3d' }}
        className="mx-auto h-auto w-full origin-center select-none"
        draggable={false}
      />
    </div>
  )
}
