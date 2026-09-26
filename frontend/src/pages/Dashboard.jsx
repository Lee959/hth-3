import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-2xl p-6 pt-4 text-center">
      <div className="rounded-3xl border border-white/20 bg-white/10 p-10 shadow-lg backdrop-blur-xl">
        <h1 className="text-3xl font-bold text-white">Train with real-time form feedback</h1>
        <p className="mt-2 text-white/70">
          One camera, three signals: rep counting from MediaPipe pose tracking, a live muscle
          heatmap, and heart rate / breathing from Presage — all in one session.
        </p>
        <Link
          to="/session"
          className="mt-6 inline-block rounded-full bg-brand-600 px-6 py-3 font-semibold shadow-lg hover:bg-brand-700"
        >
          Start a workout
        </Link>
      </div>
    </div>
  )
}
