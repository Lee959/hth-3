/**
 * The one shared surface every immersive-HUD element sits in — each
 * metric, control, and readout gets its own tile rather than several
 * elements sharing one big card. Compose with layout classes via
 * `className` (width, padding, text alignment, etc.).
 *
 * Uses the `.liquid-glass` utility (styles/index.css) — the same richer,
 * diagonal-sheen surface the non-immersive pages (Dashboard.jsx,
 * WorkoutSummary.jsx) use, ported over from the dev/metrics-board branch —
 * rather than a flat `bg-white/10` fill, so the whole app (immersive HUD
 * included) reads as one consistent glass language.
 */
export default function GlassTile({ children, className = '' }) {
  return <div className={`liquid-glass rounded-2xl ${className}`}>{children}</div>
}
