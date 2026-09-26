import { Link } from 'react-router-dom'

import AmbientBackground from './AmbientBackground.jsx'
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

// Matches dev/metrics-board's Dashboard.jsx StatTile exactly (tracking-wide
// label, big Rajdhani-bold number — not font-anton, which stays reserved
// for the live HUD's RepCounter/RestTimer scoreboard numbers — light
// sublabel underneath), so this screen reads as the same "metrics board"
// visual language as that redesign rather than the immersive HUD's tiles.
function StatTile({ label, value, sublabel }) {
  return (
    <div className="liquid-glass rounded-3xl p-5 text-center">
      <p className="font-rajdhani text-xs font-bold uppercase tracking-[0.18em] text-white/60">{label}</p>
      <p className="mt-2 font-rajdhani text-4xl font-bold leading-none text-white">{value}</p>
      {sublabel && <p className="mt-2 font-rajdhani text-sm font-light text-white/50">{sublabel}</p>}
    </div>
  )
}

/**
 * Full-screen "pop out" shown after End Workout — a snapshot of the session
 * WorkoutSession.jsx captured just before resetting the live tracker (see
 * handleEndSession), not a live view. Purely visual: the workout itself is
 * saved by WorkoutSession.jsx (lib/workoutSaver.js) as this pops up — only
 * its raw sets, heart rate readings and times, which the home page's
 * summary is worked out from.
 */
export default function WorkoutSummary({ summary, onDone, stream }) {
  const { completedSets, totalDurationMs, totalRestMs, avgHeartRateBpm, scores } = summary
  const activeDurationMs = Math.max(0, totalDurationMs - totalRestMs)
  const rows = groupSets(completedSets)
  const zone = zoneForBpm(avgHeartRateBpm)

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#07060d] px-4 py-8">
      {/* Same ambient backdrop as dev/metrics-board's non-immersive pages —
          glows sampled from the still-live camera feed if there is one,
          otherwise the HUD's own palette drifting over near-black. */}
      <AmbientBackground stream={stream} />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center gap-6">
        <h1 className="font-rajdhani text-4xl font-bold uppercase tracking-wide text-white">Workout Saved</h1>

        {/* Front + back muscle load, same heatmap/weighting the live HUD
            uses (see lib/muscleMap.js's summaryScoresFor) but as one
            whole-session snapshot instead of a decaying live value. */}
        <div className="flex gap-3">
          <MuscleHeatmap scores={scores} view="FRONT" figureWidth={140} />
          <MuscleHeatmap scores={scores} view="BACK" figureWidth={140} />
        </div>
        <div className="liquid-glass flex items-center gap-2 rounded-full px-4 py-2">
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
        </div>

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
        <div className="liquid-glass w-full rounded-3xl p-5">
          <div className="mb-2 flex justify-between font-rajdhani text-xs font-bold uppercase tracking-[0.18em] text-white/60">
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
        </div>

        <div className="flex w-full gap-3">
          <Link
            to="/"
            className="liquid-glass flex-1 rounded-full py-3 text-center font-rajdhani text-sm font-bold uppercase tracking-wide text-white transition hover:border-white/35"
          >
            Home
          </Link>
          <button
            type="button"
            onClick={onDone}
            className="liquid-glass flex-1 rounded-full py-3 text-center font-rajdhani text-sm font-bold uppercase tracking-wide text-white transition hover:border-white/35"
          >
            New Workout
          </button>
        </div>
      </div>
    </div>
  )
}
