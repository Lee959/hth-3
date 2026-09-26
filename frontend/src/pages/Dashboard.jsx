import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-2xl p-6 pt-4 text-center">
      <div className="rounded-3xl border border-white/20 bg-white/10 p-10 shadow-lg backdrop-blur-xl">
        <h1 className="font-rajdhani text-3xl font-bold uppercase tracking-wide text-white">
          Train with real-time form feedback
        </h1>
        <p className="mt-2 font-rajdhani font-light text-white/70">
          One camera, three signals: rep counting from MediaPipe pose tracking, a live muscle
          heatmap, and heart rate / breathing from Presage — all in one session.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            to="/session"
            className="inline-block rounded-full bg-brand-600 px-6 py-3 font-semibold shadow-lg hover:bg-brand-700"
          >
            Start a workout
          </Link>
          <Link to="/history" className="text-sm text-white/60 hover:text-white">
            View history
          </Link>
        </div>
      </div>
    </div>
  )
}
