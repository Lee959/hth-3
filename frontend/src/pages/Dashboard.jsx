import HeartRateChart from '../components/HeartRateChart.jsx'
import HistorySidebar from '../components/HistorySidebar.jsx'
import MuscleHeatmap from '../components/MuscleHeatmap.jsx'
import RepsByExerciseChart from '../components/RepsByExerciseChart.jsx'
import ScoreRing from '../components/ScoreRing.jsx'
import Sparkline from '../components/Sparkline.jsx'
import StartWorkoutDock from '../components/StartWorkoutDock.jsx'
import ZoneBar from '../components/ZoneBar.jsx'
import { useWorkoutSummary } from '../hooks/useWorkoutSummary.js'
import { EXERCISE_MUSCLE_WEIGHTS } from '../lib/muscleMap.js'

// Validated against the dark glass surface (dataviz palette check). Rose is
// everything heart-rate driven (heart rate, effort — echoing the HUD's
// rep-goal ring); teal is everything movement driven (reps, form, quality).
const HEART_COLOR = '#f43f5e'
const MOVEMENT_COLOR = '#10a898'

function prettify(name) {
  return name
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatNumber(n) {
  return n == null ? '—' : n.toLocaleString()
}

function formRating(score) {
  if (score == null) return null
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Fair'
  return 'Needs work'
}

function effortRating(score) {
  if (score == null) return null
  if (score >= 80) return 'All out'
  if (score >= 60) return 'Hard'
  if (score >= 30) return 'Moderate'
  return 'Light'
}

/**
 * Total load per muscle group across all workouts: each exercise's reps
 * times its muscle weights (lib/muscleMap.js), scaled so the most-worked
 * muscle is 100 — the same 0-100 score the session heatmap uses.
 */
function muscleLoad(repsByExercise = []) {
  const load = {}
  for (const { exercise, reps } of repsByExercise) {
    for (const [muscle, weight] of Object.entries(EXERCISE_MUSCLE_WEIGHTS[exercise] ?? {})) {
      load[muscle] = (load[muscle] ?? 0) + reps * weight
    }
  }
  const max = Math.max(0, ...Object.values(load))
  return Object.fromEntries(Object.entries(load).map(([m, v]) => [m, max ? Math.round((v / max) * 100) : 0]))
}

/** Latest workout's form vs the average of the earlier ones in the trend. */
function formChange(trend = []) {
  if (trend.length < 2) return null
  const earlier = trend.slice(0, -1)
  const earlierAvg = earlier.reduce((sum, p) => sum + p.score, 0) / earlier.length
  return Math.round(trend[trend.length - 1].score - earlierAvg)
}

/** The single weakest movement-quality number across exercises, as a coaching nudge. */
function weakestSpot(rows = []) {
  let worst = null
  for (const row of rows) {
    for (const [key, label] of [
      ['range_of_motion', 'range of motion'],
      ['symmetry', 'left/right balance'],
    ]) {
      if (row[key] != null && (worst == null || row[key] < worst.value)) {
        worst = { exercise: row.exercise, label, value: row[key] }
      }
    }
  }
  return worst && worst.value < 85 ? worst : null
}

function ArrowIcon({ up }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 ${up ? '' : 'rotate-180'}`}>
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  )
}

function StatTile({ label, value, unit, note }) {
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

function Card({ title, subtitle, aside, className = '', children }) {
  return (
    <section className={`liquid-glass flex flex-col rounded-3xl p-5 md:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="font-rajdhani text-lg font-bold uppercase tracking-wide text-white">{title}</h2>
          {subtitle && <p className="font-rajdhani text-sm font-light text-white/50">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

function CardEmpty({ children }) {
  return (
    <p className="flex flex-1 items-center justify-center py-8 text-center font-rajdhani text-sm font-light text-white/50">
      {children}
    </p>
  )
}

function FormScoreCard({ form }) {
  const change = formChange(form?.trend)
  return (
    <Card title="Form score" subtitle="Average across all reps">
      {form?.score != null ? (
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-center gap-5">
            <ScoreRing value={form.score} color={MOVEMENT_COLOR} caption={formRating(form.score)} />
            <div className="font-rajdhani">
              {change != null && (
                <>
                  <p className={`flex items-center gap-1 text-lg font-bold leading-tight ${change >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                    <ArrowIcon up={change >= 0} />
                    {change >= 0 ? '+' : ''}
                    {change}
                  </p>
                  <p className="text-xs font-light text-white/60">latest vs earlier workouts</p>
                </>
              )}
              <p className="mt-2 text-sm font-light leading-snug text-white/50">
                Blends range of motion, left/right balance and tempo.
              </p>
            </div>
          </div>
          <Sparkline points={form.trend} color={MOVEMENT_COLOR} label="Form score" />
        </div>
      ) : (
        <CardEmpty>Your form score appears after your first tracked reps.</CardEmpty>
      )}
    </Card>
  )
}

function EffortScoreCard({ effort }) {
  const latest = effort?.latest
  return (
    <Card
      title="Effort"
      subtitle="Latest workout"
      aside={
        effort?.average != null && (
          <p className="text-right font-rajdhani">
            <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">Avg</span>
            <span className="text-lg font-bold leading-tight text-white">{effort.average}</span>
          </p>
        )
      }
    >
      {latest ? (
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-center gap-5">
            <ScoreRing value={latest.score} color={HEART_COLOR} caption={effortRating(latest.score)} />
            <p className="font-rajdhani text-sm font-light leading-snug text-white/50">
              {latest.has_heart_rate
                ? 'From time in each heart-rate zone, plus reps.'
                : 'No heart-rate data for this one, so it’s based on reps only.'}
            </p>
          </div>
          {latest.has_heart_rate && <ZoneBar minutes={latest.zone_minutes} />}
          <Sparkline points={effort.trend} color={HEART_COLOR} label="Effort score" />
        </div>
      ) : (
        <CardEmpty>Finish a workout to get your first effort score.</CardEmpty>
      )}
    </Card>
  )
}

function Meter({ label, value, color }) {
  return (
    <div>
      <div className="flex items-baseline justify-between font-rajdhani">
        <span className="text-sm font-semibold uppercase tracking-wide text-white/70">{label}</span>
        <span className="text-sm font-bold text-white">
          {value == null ? '—' : `${Math.round(value)}%`}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ backgroundColor: `${color}26` }}>
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${value ?? 0}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function MovementQualityCard({ movement, rows }) {
  const hasData = movement && (movement.range_of_motion != null || movement.symmetry != null)
  const weakest = weakestSpot(rows)
  return (
    <Card title="Movement quality" subtitle="Average across all reps">
      {hasData ? (
        <div className="flex flex-1 flex-col gap-4">
          <Meter label="Range of motion" value={movement.range_of_motion} color={MOVEMENT_COLOR} />
          <Meter label="Left/right balance" value={movement.symmetry} color={MOVEMENT_COLOR} />
          <div className="flex items-baseline justify-between font-rajdhani">
            <span className="text-sm font-semibold uppercase tracking-wide text-white/70">Tempo</span>
            <span className="text-sm font-bold text-white">
              {movement.avg_rep_seconds == null ? '—' : `${movement.avg_rep_seconds}s`}
              <span className="font-light text-white/50"> per rep</span>
            </span>
          </div>
          {weakest && (
            <p className="mt-auto rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-rajdhani text-sm font-light leading-snug text-white/70">
              <span className="font-bold uppercase tracking-wide text-white">Focus: </span>
              {prettify(weakest.exercise)} {weakest.label} is at {Math.round(weakest.value)}%. Your lowest
              right now.
            </p>
          )}
        </div>
      ) : (
        <CardEmpty>Range of motion, balance and tempo show up once reps are tracked.</CardEmpty>
      )}
    </Card>
  )
}

function EmptySummary() {
  return (
    <div className="liquid-glass mx-auto mt-10 flex max-w-lg flex-col items-center gap-3 rounded-[2rem] px-8 py-12 text-center">
      <h2 className="font-rajdhani text-2xl font-bold uppercase tracking-wide text-white">No workouts yet</h2>
      <p className="font-rajdhani font-light text-white/60">
        Finish your first session and your reps, form, effort and heart rate will add up here.
      </p>
    </div>
  )
}

export default function Dashboard() {
  const { status, summary, isSample } = useWorkoutSummary()
  const loading = status === 'loading'

  if (status === 'ready' && summary?.total_workouts === 0) {
    return (
      <div className="px-4 pb-36 pt-4">
        <HistorySidebar />
        <EmptySummary />
        <StartWorkoutDock />
      </div>
    )
  }

  const s = summary ?? {}
  const trace = s.latest_heart_rate?.points ?? []
  const traceBpms = trace.map((p) => p.bpm)
  const scores = muscleLoad(s.reps_by_exercise)
  const topMuscles = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
  const repsPerWorkout = s.total_workouts ? Math.round(s.total_reps / s.total_workouts) : null
  const minutesPerWorkout = s.total_workouts ? Math.round(s.active_minutes / s.total_workouts) : null

  return (
    // Bottom padding keeps the last card clear of the floating button.
    <div className="mx-auto max-w-6xl px-4 pb-36 pt-4 md:px-8 md:pt-6">
      <HistorySidebar />

      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-rajdhani text-3xl font-bold uppercase tracking-wide text-white md:text-4xl">
            Your summary
          </h1>
          {isSample && (
            <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 font-rajdhani text-xs font-semibold uppercase tracking-wide text-amber-100/90">
              Sample data · log in to see yours
            </span>
          )}
        </div>
        <p className="mt-1 font-rajdhani font-light text-white/60">Every workout, all time.</p>
      </header>

      {status === 'error' && (
        <p className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-2 font-rajdhani text-sm text-amber-100/90">
          Couldn’t load your summary. Is the backend running?
        </p>
      )}

      <div className={`transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`} aria-busy={loading}>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Workouts" value={formatNumber(s.total_workouts)} />
          <StatTile
            label="Total reps"
            value={formatNumber(s.total_reps)}
            note={repsPerWorkout != null ? `${repsPerWorkout} per workout` : null}
          />
          <StatTile
            label="Active time"
            value={formatNumber(s.active_minutes)}
            unit="min"
            note={minutesPerWorkout != null ? `${minutesPerWorkout} min per workout` : null}
          />
          <StatTile label="Avg heart rate" value={formatNumber(s.avg_heart_rate_bpm)} unit="bpm" />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <FormScoreCard form={s.form} />
          <EffortScoreCard effort={s.effort} />
          <MovementQualityCard movement={s.movement} rows={s.reps_by_exercise} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card
            title="Heart rate"
            subtitle="During your latest workout"
            className="lg:col-span-2"
            aside={
              traceBpms.length > 0 && (
                <dl className="flex gap-5 font-rajdhani">
                  {[
                    ['Low', Math.min(...traceBpms)],
                    ['Avg', Math.round(traceBpms.reduce((a, b) => a + b, 0) / traceBpms.length)],
                    ['Peak', Math.max(...traceBpms)],
                  ].map(([label, value]) => (
                    <div key={label} className="text-right">
                      <dt className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">{label}</dt>
                      <dd className="text-lg font-bold leading-tight text-white">{value}</dd>
                    </div>
                  ))}
                </dl>
              )
            }
          >
            {trace.length > 1 ? (
              <HeartRateChart points={trace} color={HEART_COLOR} />
            ) : (
              <CardEmpty>No heart-rate readings yet — they come from the camera during a workout.</CardEmpty>
            )}
          </Card>

          <Card title="Muscles worked" subtitle="Total load, all workouts" className="lg:row-span-2">
            {topMuscles.length > 0 ? (
              <div className="flex flex-1 flex-col items-center gap-5">
                <MuscleHeatmap scores={scores} figureWidth={170} />
                <ol className="w-full space-y-2">
                  {topMuscles.map(([muscle, score], i) => (
                    <li key={muscle} className="flex items-baseline justify-between font-rajdhani">
                      <span className="text-sm font-semibold uppercase tracking-wide text-white/80">
                        <span className="mr-2 text-white/40">{i + 1}</span>
                        {prettify(muscle)}
                      </span>
                      <span className="text-sm font-bold text-white">
                        {score}
                        <span className="font-light text-white/50">/100</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <CardEmpty>Muscles light up here as you log reps.</CardEmpty>
            )}
          </Card>

          <Card title="By exercise" subtitle="Reps and form, all workouts" className="lg:col-span-2">
            {s.reps_by_exercise?.length ? (
              <RepsByExerciseChart rows={s.reps_by_exercise} color={MOVEMENT_COLOR} />
            ) : (
              <CardEmpty>No reps logged yet.</CardEmpty>
            )}
          </Card>
        </div>
      </div>

      <StartWorkoutDock />
    </div>
  )
}
