export default function History() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="rounded-3xl border border-white/20 bg-white/10 p-6 shadow-lg backdrop-blur-xl">
        <h1 className="font-rajdhani text-2xl font-bold uppercase tracking-wide text-white">History</h1>
        <p className="mt-2 font-rajdhani font-light text-white/70">
          Wire this up to a new GET /api/workouts list endpoint to show past sessions, reps per
          exercise, and vitals trends over time.
        </p>
      </div>
    </div>
  )
}
