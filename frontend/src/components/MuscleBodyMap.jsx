import Model from 'react-body-highlighter'

/**
 * Lights up muscle groups as the pose engine reports which exercise is
 * being performed. `activeMuscles` values must match react-body-highlighter's
 * muscle labels — see backend/app/pose_engine/muscle_map.py for the
 * exercise -> muscle mapping that feeds this.
 */
export default function MuscleBodyMap({ activeMuscles = [] }) {
  const data = activeMuscles.map((muscle) => ({ name: muscle, muscles: [muscle] }))

  return (
    <div className="flex justify-center rounded-2xl bg-slate-900 p-4">
      <Model data={data} style={{ width: '12rem' }} highlightedColors={['#4f46e5', '#818cf8']} />
    </div>
  )
}
