/**
 * The one shared "liquid glass" surface every HUD element sits in — each
 * metric, control, and readout gets its own tile rather than several
 * elements sharing one big card. Compose with layout classes via
 * `className` (width, padding, text alignment, etc.).
 */
export default function GlassTile({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-white/20 bg-white/10 shadow-lg backdrop-blur-xl ${className}`}>
      {children}
    </div>
  )
}
