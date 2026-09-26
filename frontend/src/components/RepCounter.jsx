export default function RepCounter({ exerciseName, reps }) {
  return (
    <div className="rounded-2xl bg-slate-900 p-4 text-center">
      <p className="text-sm uppercase tracking-wide text-slate-400">
        {exerciseName || 'No exercise detected'}
      </p>
      <p className="text-5xl font-bold text-brand-500">{reps}</p>
      <p className="text-sm text-slate-400">reps</p>
    </div>
  )
}
