import { useState } from 'react'

function prettify(name) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Horizontal bars, one per exercise, sorted by reps. A single series, so a
 * single hue and no legend; every bar carries its value at the tip, and
 * hover/focus lifts the bar and adds its share of all reps. When rows carry
 * a `form_score`, it gets its own right-hand column as plain text.
 */
export default function RepsByExerciseChart({ rows, color = '#10a898' }) {
  const [active, setActive] = useState(null)
  if (!rows?.length) return null

  const max = Math.max(...rows.map((r) => r.reps), 1)
  const total = rows.reduce((sum, r) => sum + r.reps, 0)
  const showForm = rows.some((r) => r.form_score != null)
  const columns = showForm ? 'grid-cols-[8rem_1fr_3rem]' : 'grid-cols-[8rem_1fr]'

  return (
    <ul className="flex flex-col gap-3">
      {showForm && (
        <li aria-hidden="true" className={`grid ${columns} gap-3 font-rajdhani text-[11px] font-bold uppercase tracking-[0.18em] text-white/40`}>
          <span>Exercise</span>
          <span>Reps</span>
          <span className="text-right">Form</span>
        </li>
      )}
      {rows.map((row) => {
        const isActive = active === row.exercise
        const share = total ? Math.round((row.reps / total) * 100) : 0
        return (
          <li
            key={row.exercise}
            tabIndex={0}
            onPointerEnter={() => setActive(row.exercise)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(row.exercise)}
            onBlur={() => setActive(null)}
            aria-label={`${prettify(row.exercise)}: ${row.reps} reps, ${share}% of all reps${
              row.form_score != null ? `, form score ${Math.round(row.form_score)}` : ''
            }`}
            className={`grid ${columns} items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/40`}
          >
            <span className="truncate font-rajdhani text-sm font-semibold uppercase tracking-wide text-white/70">
              {prettify(row.exercise)}
            </span>
            {/* Right padding reserves room for the value label, so bar
                lengths stay proportional to each other and the label at the
                longest bar's tip never overflows the card. */}
            <span className="flex min-w-0 items-center gap-2 pr-[5.5rem]">
              <span
                className="h-4 shrink-0 rounded-r transition-[filter,width] duration-300"
                style={{
                  width: `${Math.max((row.reps / max) * 100, 2)}%`,
                  backgroundColor: color,
                  filter: isActive ? 'brightness(1.25)' : undefined,
                }}
              />
              <span className="whitespace-nowrap font-rajdhani text-sm font-bold text-white">
                {row.reps}
                {isActive && <span className="ml-1.5 font-light text-white/50">· {share}%</span>}
              </span>
            </span>
            {showForm && (
              <span className="text-right font-rajdhani text-sm font-bold text-white/80">
                {row.form_score != null ? Math.round(row.form_score) : '—'}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
