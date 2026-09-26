import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-3xl p-6 text-center">
      <h1 className="text-3xl font-bold">Train with real-time form feedback</h1>
      <p className="mt-2 text-slate-400">
        One camera, three signals: rep counting from MediaPipe pose tracking, muscle groups
        worked, and heart rate / breathing from Presage — all in one session.
      </p>
      <Link
        to="/session"
        className="mt-6 inline-block rounded-xl bg-brand-600 px-6 py-3 font-semibold hover:bg-brand-700"
      >
        Start a workout
      </Link>
    </div>
  )
}
