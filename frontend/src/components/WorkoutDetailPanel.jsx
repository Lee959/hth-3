import { useEffect, useRef, useState } from 'react'

import HeartRateChart from './HeartRateChart.jsx'
import MuscleHeatmap from './MuscleHeatmap.jsx'
import ScoreRing from './ScoreRing.jsx'
import ZoneBar from './ZoneBar.jsx'
import { useWorkoutDetail } from '../hooks/useWorkoutDetail.js'
import { summaryScoresFor } from '../lib/muscleMap.js'
import { HEART_COLOR, MOVEMENT_COLOR, effortRating, formRating } from '../lib/scores.js'

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function TrashIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" />
    </svg>
  )
}

function prettify(name) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDuration(totalSeconds) {
  if (totalSeconds == null) return '—'
  const seconds = Math.floor(totalSeconds)
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

function durationSeconds(workout) {
  if (workout.duration_sec != null) return workout.duration_sec
  if (!workout.started_at || !workout.ended_at) return null
  return Math.max(0, (new Date(workout.ended_at) - new Date(workout.started_at)) / 1000)
}

/** Mean of [value, weight] pairs, skipping missing values (the backend's _weighted_mean). */
function weightedMean(pairs) {
  let sum = 0
  let total = 0
  for (const [value, weight] of pairs) {
    if (value != null && weight) {
      sum += value * weight
      total += weight
    }
  }
  return total ? sum / total : null
}

/** One row per exercise, in the order first done: sets, reps and rep-weighted form. */
function exerciseRows(sets) {
  const byExercise = new Map()
  for (const set of sets) {
    if (!byExercise.has(set.exercise_name)) byExercise.set(set.exercise_name, [])
    byExercise.get(set.exercise_name).push(set)
  }
  return [...byExercise].map(([exercise, rows]) => ({
    exercise,
    sets: rows.length,
    reps: rows.reduce((sum, s) => sum + (s.reps ?? 0), 0),
    form: weightedMean(rows.map((s) => [s.form_score, s.reps])),
  }))
}

/** Heart-rate readings as (seconds into the workout, bpm) chart points. */
function heartRatePoints(workout) {
  const start = new Date(workout.started_at)
  return workout.vitals
    .filter((v) => v.heart_rate_bpm != null)
    .map((v) => ({ t_sec: (new Date(v.recorded_at) - start) / 1000, bpm: v.heart_rate_bpm }))
}

function Stat({ label, value, unit }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="font-rajdhani text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="font-rajdhani text-2xl font-bold leading-none text-white">{value}</span>
        {unit && <span className="font-rajdhani text-xs font-light text-white/50">{unit}</span>}
      </p>
    </div>
  )
}

function Section({ title, className = '', children }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4 ${className}`}>
      <h3 className="mb-3 font-rajdhani text-xs font-bold uppercase tracking-[0.18em] text-white/60">{title}</h3>
      {children}
    </section>
  )
}

/**
 * Stands in for HeartRateChart when there's nothing to draw: same height
 * and faint gridlines (inside the same margins), so the card keeps its
 * shape and the layout around it doesn't shift.
 */
function EmptyHeartRateChart({ children }) {
  return (
    <div className="relative flex h-[200px] items-center justify-center">
      <div aria-hidden="true" className="absolute bottom-[26px] left-9 right-16 top-[22px] flex flex-col justify-between">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-px bg-white/[0.08]" />
        ))}
      </div>
      <p className="relative px-6 text-center font-rajdhani text-sm font-light text-white/50">{children}</p>
    </div>
  )
}

function Message({ children }) {
  return (
    <p className="flex flex-1 items-center justify-center px-6 py-16 text-center font-rajdhani text-sm font-light text-white/50">
      {children}
    </p>
  )
}

/** The panel's body for one workout, loaded from GET /api/workouts/<id>. */
function WorkoutDetail({ sessionId }) {
  const { status, workout } = useWorkoutDetail(sessionId)

  if (status === 'loading') return <Message>Loading workout…</Message>
  if (!workout) return <Message>Couldn’t load this workout. Is the backend running?</Message>

  const sets = workout.exercise_sets
  const rows = exerciseRows(sets)
  const totalReps = rows.reduce((sum, r) => sum + r.reps, 0)
  const trace = heartRatePoints(workout)
  const bpms = trace.map((p) => p.bpm)
  const form = weightedMean(sets.map((s) => [s.form_score, s.reps]))
  const movement = {
    rangeOfMotion: weightedMean(sets.map((s) => [s.range_of_motion, s.reps])),
    symmetry: weightedMean(sets.map((s) => [s.symmetry, s.reps])),
    repSeconds: weightedMean(sets.map((s) => [s.avg_rep_seconds, s.reps])),
  }
  const hasMovement = Object.values(movement).some((v) => v != null)
  const effort = workout.effort
  const muscles = summaryScoresFor(sets.map((s) => ({ exerciseName: s.exercise_name, reps: s.reps ?? 0 })))

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Duration" value={formatDuration(durationSeconds(workout))} />
        <Stat label="Total reps" value={totalReps} />
        <Stat
          label="Avg heart rate"
          value={bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : '—'}
          unit={bpms.length ? 'bpm' : null}
        />
        <Stat label="Peak heart rate" value={bpms.length ? Math.max(...bpms) : '—'} unit={bpms.length ? 'bpm' : null} />
      </div>

      {/* One column on phones; two, then three as the panel gets wider:
          scores beside the heart rate, then exercises and movement beside
          the muscle maps (dense packing tucks them in to its left). */}
      <div className="grid grid-flow-row-dense gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Section title="Scores">
          <div className="flex justify-around gap-3">
            <figure className="flex flex-col items-center gap-2">
              <ScoreRing value={form} color={MOVEMENT_COLOR} caption={formRating(form)} />
              <figcaption className="font-rajdhani text-xs font-semibold uppercase tracking-wide text-white/60">Form</figcaption>
            </figure>
            <figure className="flex flex-col items-center gap-2">
              <ScoreRing value={effort?.score} color={HEART_COLOR} caption={effortRating(effort?.score)} />
              <figcaption className="font-rajdhani text-xs font-semibold uppercase tracking-wide text-white/60">Effort</figcaption>
            </figure>
          </div>
          {effort?.has_heart_rate && (
            <div className="mt-4">
              <ZoneBar minutes={effort.zone_minutes} />
            </div>
          )}
        </Section>

        <Section title="Heart rate" className="xl:col-span-2">
          {trace.length > 1 ? (
            <HeartRateChart points={trace} color={HEART_COLOR} />
          ) : (
            <EmptyHeartRateChart>
              {trace.length
                ? 'Only one heart-rate reading, not enough to chart.'
                : 'No heart-rate readings for this workout.'}
            </EmptyHeartRateChart>
          )}
        </Section>

        {Object.keys(muscles).length > 0 && (
          <Section title="Muscles worked" className="order-last lg:order-none lg:col-start-2 lg:row-span-2 xl:col-start-3">
            <div className="flex justify-center gap-3">
              <MuscleHeatmap scores={muscles} view="FRONT" figureWidth={120} />
              <MuscleHeatmap scores={muscles} view="BACK" figureWidth={120} />
            </div>
          </Section>
        )}

        <Section title="Exercises" className="xl:col-span-2">
          {rows.length === 0 ? (
            <p className="py-2 text-center font-rajdhani text-sm font-light text-white/40">No sets logged.</p>
          ) : (
            <table className="w-full font-rajdhani text-sm text-white">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">
                  <th scope="col" className="pb-2 text-left font-bold">Exercise</th>
                  <th scope="col" className="w-12 pb-2 text-right font-bold">Sets</th>
                  <th scope="col" className="w-12 pb-2 text-right font-bold">Reps</th>
                  <th scope="col" className="w-12 pb-2 text-right font-bold">Form</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((row) => (
                  <tr key={row.exercise}>
                    <td className="py-1 font-light">{prettify(row.exercise)}</td>
                    <td className="py-1 text-right font-bold">{row.sets}</td>
                    <td className="py-1 text-right font-bold">{row.reps}</td>
                    <td className="py-1 text-right font-bold">{row.form == null ? '—' : Math.round(row.form)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {hasMovement && (
          <Section title="Movement quality" className="xl:col-span-2">
            <dl className="grid grid-cols-3 gap-2 font-rajdhani">
              {[
                ['Range', movement.rangeOfMotion == null ? '—' : `${Math.round(movement.rangeOfMotion)}%`],
                ['Balance', movement.symmetry == null ? '—' : `${Math.round(movement.symmetry)}%`],
                ['Tempo', movement.repSeconds == null ? '—' : `${movement.repSeconds.toFixed(1)}s`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">{label}</dt>
                  <dd className="text-lg font-bold leading-tight text-white">{value}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}
      </div>
    </div>
  )
}

/**
 * "Delete this workout?" as a pop-up: a native <dialog> opened with
 * showModal(), so it sits above everything, dims the page behind it and
 * keeps keyboard focus inside. Cancel, Escape or a click on the dimmed
 * backdrop back out.
 */
function ConfirmDeleteDialog({ open, workoutLabel, onCancel, onConfirm }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="delete-workout-title"
      aria-describedby="delete-workout-body"
      onClose={onCancel}
      onKeyDown={(event) => {
        // Escape closes just this, not the summary and history behind it.
        if (event.key === 'Escape') event.stopPropagation()
      }}
      onClick={(event) => {
        // A click on the dimmed backdrop lands on the <dialog> itself.
        if (event.target === event.currentTarget) onCancel()
      }}
      className="animate-dialog-in w-[min(24rem,calc(100vw-2rem))] rounded-3xl border border-white/15 bg-[#16121d] p-0 text-white shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col items-center px-6 pb-6 pt-7 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
          <TrashIcon className="h-5 w-5" />
        </span>
        <h2 id="delete-workout-title" className="mt-4 font-rajdhani text-xl font-bold uppercase tracking-wide">
          Delete this workout?
        </h2>
        <p id="delete-workout-body" className="mt-2 font-rajdhani text-sm font-light leading-relaxed text-white/60">
          <span className="font-semibold text-white/85">{workoutLabel}</span> will be deleted for good, along with
          its sets, reps and heart-rate data. This can’t be undone.
        </p>
        <div className="mt-6 grid w-full grid-cols-2 gap-3">
          {/* First, so showModal() focuses it and a stray Enter doesn't delete. */}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl bg-white/10 py-2.5 font-rajdhani text-sm font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-2xl bg-rose-500 py-2.5 font-rajdhani text-sm font-bold uppercase tracking-wide text-white transition hover:bg-rose-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Delete
          </button>
        </div>
      </div>
    </dialog>
  )
}

/**
 * One past workout's summary, opened by clicking it in the history sidebar
 * (which stays locked open alongside it) and filling the rest of the
 * screen to its right. It stays up until `onClose`, from its close button
 * here or Escape in HistorySidebar, which puts both away. The Delete
 * button at the bottom asks first (ConfirmDeleteDialog), then calls
 * `onDelete(id)`.
 */
export default function WorkoutDetailPanel({ session, onClose, onDelete }) {
  const open = session != null
  // Keeps the last workout on screen while the panel slides away.
  const [shown, setShown] = useState(session)
  if (session && session !== shown) setShown(session)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => setConfirmingDelete(false), [session?.id])

  const started = shown?.started_at ? new Date(shown.started_at) : null
  const title = shown?.exercises?.length ? shown.exercises.map(prettify).join(', ') : 'Workout'
  const date = started?.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  const time = started?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  return (
    <aside
      aria-label="Workout details"
      onTransitionEnd={(event) => {
        if (!open && event.target === event.currentTarget && event.propertyName === 'transform') setShown(null)
      }}
      className={`liquid-glass fixed inset-y-3 left-3 right-3 z-40 flex flex-col rounded-3xl bg-[#07060d]/25 md:left-[19.5rem] transition-[transform,opacity,visibility] duration-300 ease-out motion-reduce:transition-none ${
        open ? 'visible translate-x-0 opacity-100' : 'invisible translate-x-[110%] opacity-0'
      }`}
    >
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="min-w-0">
          {started && (
            <p className="font-rajdhani text-xs font-bold uppercase tracking-[0.18em] text-white/50">
              {date} · {time}
            </p>
          )}
          <h2 className="mt-0.5 font-rajdhani text-xl font-bold uppercase leading-tight tracking-wide text-white">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close workout details"
          className="shrink-0 rounded-full bg-white/10 p-2 text-white/70 transition hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="mx-5 h-px bg-white/10" />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {shown && <WorkoutDetail key={shown.id} sessionId={shown.id} />}
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          disabled={!open}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 font-rajdhani text-sm font-semibold uppercase tracking-wide text-rose-300/90 transition hover:bg-rose-500/15 hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60"
        >
          <TrashIcon />
          Delete workout
        </button>
      </div>

      <ConfirmDeleteDialog
        open={open && confirmingDelete}
        workoutLabel={started ? `${title} (${date}, ${time})` : title}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false)
          onDelete(shown.id)
        }}
      />
    </aside>
  )
}
