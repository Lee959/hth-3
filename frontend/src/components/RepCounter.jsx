function prettify(name) {
  if (!name) return null
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function RepCounter({ exerciseName, reps }) {
  return (
    <div className="rounded-3xl border border-white/20 bg-white/10 p-4 text-center shadow-lg backdrop-blur-xl">
      <p className="text-sm uppercase tracking-wide text-white/60">
        {prettify(exerciseName) || 'No exercise detected'}
      </p>
      <p className="text-5xl font-bold text-white">{reps}</p>
      <p className="text-sm text-white/60">reps</p>
    </div>
  )
}
