import GlassTile from './GlassTile.jsx'

function prettify(name) {
  if (!name) return null
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Current-exercise indicator — its own tile, sits above RepCounter.jsx. */
export default function ExerciseTitle({ exerciseName }) {
  return (
    <GlassTile className="p-3 text-center">
      <p className="font-rajdhani text-base font-bold uppercase tracking-wide text-white">
        {prettify(exerciseName) || 'No Exercise'}
      </p>
    </GlassTile>
  )
}
