import GlassTile from './GlassTile.jsx'

/** Rep count — its own tile; the exercise name lives in ExerciseTitle.jsx above it. */
export default function RepCounter({ reps }) {
  return (
    <GlassTile className="p-4 text-center">
      <p className="font-anton text-6xl leading-none text-white">{reps}</p>
      <p className="mt-1 font-rajdhani text-sm font-light uppercase tracking-wide text-white/60">reps</p>
    </GlassTile>
  )
}
