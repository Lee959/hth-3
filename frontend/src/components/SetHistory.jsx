function prettify(name) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Lists sets completed this session (see useExerciseTracker's
 * `completedSets` — a set closes when the active exercise's angle stops
 * swinging enough and the hook enters its resting phase). Purely a
 * client-side view of the same list WorkoutSession.jsx persists via
 * POST /api/workouts/:id/sets.
 */
export default function SetHistory({ sets = [] }) {
  return (
    <div className="rounded-3xl border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-xl">
      <p className="text-sm uppercase tracking-wide text-white/60">Sets this session</p>
      {sets.length === 0 ? (
        <p className="mt-2 text-sm text-white/40">Complete a set to see it here.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {sets
            .slice()
            .reverse()
            .map((set) => (
              <li key={set.completedAt} className="flex justify-between text-sm text-white/80">
                <span>{prettify(set.exerciseName)}</span>
                <span className="font-semibold">{set.reps} reps</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
