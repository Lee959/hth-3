import { Link } from 'react-router-dom'

import GlassTile from './GlassTile.jsx'
import MuscleHeatmap, { HEATMAP_RED } from './MuscleHeatmap.jsx'
import { zoneForBpm } from '../lib/heartRateZones.js'

function prettify(name) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n) => n.toString().padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

// Groups the flat completedSets log (one entry per finished set, in
// chronological order) into the per-exercise SETS/REPS rows the summary
// table shows, same exercise order as first performed.
function groupSets(completedSets) {
  const order = []
  const byExercise = new Map()
  for (const { exerciseName, reps } of completedSets) {
    if (!byExercise.has(exerciseName)) {
      byExercise.set(exerciseName, { exerciseName, sets: 0, totalReps: 0 })
      order.push(exerciseName)
    }
    const row = byExercise.get(exerciseName)
    row.sets += 1
    row.totalReps += reps
  }
  return order.map((name) => byExercise.get(name))
}

// Same shape as MetricsSidebar.jsx's StatTile (label on top, semibold value,
// light sublabel/unit below) so the summary's stat tiles read as the same
// family as the live HUD's metrics board, not a separate visual language.
function StatTile({ label, value, sublabel }) {
  return (
    <GlassTile className="p-3 text-center">
      <p className="font-rajdhani text-xs font-bold uppercase tracking-wide text-white/80">{label}</p>
      <p className="text-xl font-semibold text-white">{value}</p>
      {sublabel && <p className="font-rajdhani text-xs font-light text-white/50">{sublabel}</p>}
    </GlassTile>
  )
}

/**
 * Full-screen "pop out" shown after End Workout — a snapshot of the session
 * WorkoutSession.jsx captured just before resetting the live tracker (see
 * handleEndSession), not a live view. Purely visual for now: `onSaveAgain`
 * is a stub the parent wires to whatever will eventually persist this
 * (see stubSaveWorkoutSummary in lib/workoutSummary.js) — no real backend
 * call happens here.
 */
export default function WorkoutSummary({ summary, onDone }) {
  const { completedSets, totalDurationMs, totalRestMs, avgHeartRateBpm, scores } = summary
  const activeDurationMs = Math.max(0, totalDurationMs - totalRestMs)
  const rows = groupSets(completedSets)
  const zone = zoneForBpm(avgHeartRateBpm)

  return (
    <div className="absolute inset-0 z-30 flex justify-center overflow-y-auto bg-black px-4 py-8">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <h1 className="font-anton text-4xl uppercase tracking-wide text-white">Workout Saved</h1>

        {/* Front + back muscle load, same heatmap/weighting the live HUD
            uses (see lib/muscleMap.js's summaryScoresFor) but as one
            whole-session snapshot instead of a decaying live value. */}
        <div className="flex gap-3">
          <MuscleHeatmap scores={scores} view="FRONT" figureWidth={140} />
          <MuscleHeatmap scores={scores} view="BACK" figureWidth={140} />
        </div>
        <GlassTile className="flex items-center gap-2 px-4 py-2">
          <span
            className="h-3 w-8 rounded-full"
            style={{ background: `linear-gradient(90deg, ${HEATMAP_RED[100]}, ${HEATMAP_RED[500]})` }}
          />
          <span className="font-rajdhani text-xs font-light uppercase tracking-wide text-white/60">
            Light load
          </span>
          <span className="font-rajdhani text-xs font-light uppercase tracking-wide text-white/60">→</span>
          <span className="font-rajdhani text-xs font-light uppercase tracking-wide text-white/60">
            Heavy load
          </span>
        </GlassTile>

        {/* Duration / heart rate / rest stats */}
        <div className="grid w-full grid-cols-2 gap-3">
          <StatTile label="Total Time" value={formatDuration(totalDurationMs)} />
          <StatTile
            label="Avg Heart Rate"
            value={avgHeartRateBpm ? Math.round(avgHeartRateBpm) : '—'}
            sublabel={avgHeartRateBpm ? `bpm · ${zone.label}` : 'No vitals data'}
          />
          <StatTile label="Active Time" value={formatDuration(activeDurationMs)} />
          <StatTile label="Rest Time" value={formatDuration(totalRestMs)} />
        </div>

        {/* Exercise breakdown, styled like a workout-plan table: name on
            the left, SETS/REPS columns on the right. */}
        <GlassTile className="w-full p-4">
          <div className="mb-2 flex justify-between font-rajdhani text-xs font-bold uppercase tracking-wide text-white/50">
            <span>Exercises</span>
            <span className="flex gap-6">
              <span className="w-10 text-right">Sets</span>
              <span className="w-10 text-right">Reps</span>
            </span>
          </div>
          {rows.length === 0 ? (
            <p className="py-4 text-center font-rajdhani text-sm font-light text-white/40">
              No sets were completed this session.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((row, i) => (
                <li key={row.exerciseName} className="flex justify-between font-rajdhani text-sm text-white">
                  <span className="font-light">
                    {i + 1}. {prettify(row.exerciseName)}
                  </span>
                  <span className="flex gap-6 font-bold tabular-nums">
                    <span className="w-10 text-right">{row.sets}</span>
                    <span className="w-10 text-right">{row.totalReps}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassTile>

        <div className="flex w-full gap-3">
          <Link
            to="/"
            className="flex-1 rounded-2xl border border-white/20 bg-white/10 py-3 text-center font-rajdhani text-sm font-bold uppercase tracking-wide text-white shadow-lg backdrop-blur-xl transition hover:bg-white/20"
          >
            Home
          </Link>
          <button
            type="button"
            onClick={onDone}
            className="flex-1 rounded-2xl border border-white/20 bg-white/20 py-3 text-center font-rajdhani text-sm font-bold uppercase tracking-wide text-white shadow-lg backdrop-blur-xl transition hover:bg-white/30"
          >
            New Workout
          </button>
        </div>
      </div>
    </div>
  )
}
