import GlassTile from './GlassTile.jsx'

function prettify(name) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Lists sets completed this session (see useExerciseTracker's
 * `completedSets` — a set closes when the active exercise's angle stops
 * swinging enough and the hook enters its resting phase). Purely a
 * client-side view of the same list WorkoutSession.jsx persists via
 * POST /api/workouts/:id/sets. Capped height + internal scroll so a long
 * session doesn't grow this tile past the rest of the right-hand column.
 */
export default function SetHistory({ sets = [] }) {
  return (
    <GlassTile className="max-h-40 overflow-y-auto p-3">
      <p className="font-rajdhani text-xs font-bold uppercase tracking-wide text-white/80">Sets this session</p>
      {sets.length === 0 ? (
        <p className="mt-2 font-rajdhani text-xs font-light text-white/40">Complete a set to see it here.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {sets
            .slice()
            .reverse()
            .map((set) => (
              <li key={set.completedAt} className="flex justify-between font-rajdhani text-xs text-white/80">
                <span className="font-light">{prettify(set.exerciseName)}</span>
                <span className="font-bold">{set.reps}</span>
              </li>
            ))}
        </ul>
      )}
    </GlassTile>
  )
}
