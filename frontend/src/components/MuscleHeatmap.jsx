import { MuscleMap } from '@musclemap/react'

/**
 * Wraps @musclemap/react — takes the { MUSCLE_GROUP: score } map from
 * useExerciseTracker and renders it as a LOAD heatmap (see
 * frontend/src/lib/muscleMap.js for the exercise -> muscle weight table
 * that produces these scores). `values` expects a `{ score }` object per
 * group, so we wrap each raw number here.
 */
export default function MuscleHeatmap({ scores = {}, figureWidth = 170 }) {
  const values = Object.fromEntries(
    Object.entries(scores).map(([group, score]) => [group, { score }]),
  )

  return (
    <div className="rounded-3xl border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-xl">
      <MuscleMap
        values={values}
        view="BOTH"
        colorModel="LOAD"
        glow
        showLegend={false}
        figureWidth={figureWidth}
      />
    </div>
  )
}
