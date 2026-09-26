import { Link, Route, Routes } from 'react-router-dom'

import { useAuth } from './auth/AuthContext.jsx'
import Dashboard from './pages/Dashboard.jsx'
import History from './pages/History.jsx'
import WorkoutSession from './pages/WorkoutSession.jsx'

export default function App() {
  const { isAuthenticated, loginWithRedirect, logout, user, configured } = useAuth()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3 md:px-8">
        <Link to="/" className="text-lg font-bold text-brand-500">
          FormCheck
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/session">Start workout</Link>
          <Link to="/history">History</Link>
          {isAuthenticated ? (
            <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
              Log out{user?.name ? ` (${user.name})` : ''}
            </button>
          ) : (
            <button
              onClick={() => loginWithRedirect()}
              disabled={!configured}
              className="rounded-lg bg-brand-600 px-3 py-1.5 disabled:opacity-40"
            >
              Log in
            </button>
          )}
        </nav>
      </header>

      {!configured && (
        <div className="bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-300">
          Auth0 isn't configured yet — set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID in
          frontend/.env. See docs/SETUP.md.
        </div>
      )}

      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/session" element={<WorkoutSession />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>
    </div>
  )
}
