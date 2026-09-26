/**
 * A bare number-plus-label glass tile — big Rajdhani-bold value, small
 * tracking-wide label above it, optional unit inline and note below.
 * Extracted from Dashboard.jsx (was a local function there) so
 * Landing.jsx's metrics-preview grid can reuse the exact same tile
 * instead of re-implementing it.
 */
export default function StatTile({ label, value, unit, note }) {
  return (
    <div className="liquid-glass rounded-3xl p-5">
      <p className="font-rajdhani text-xs font-bold uppercase tracking-[0.18em] text-white/60">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-rajdhani text-4xl font-bold leading-none text-white">{value}</span>
        {unit && <span className="font-rajdhani text-sm font-light text-white/50">{unit}</span>}
      </p>
      {note && <p className="mt-2 font-rajdhani text-sm font-light text-white/50">{note}</p>}
    </div>
  )
}
