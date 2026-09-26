import { Link, Route, Routes, useLocation } from 'react-router-dom'

import { useAuth } from './auth/AuthContext.jsx'
import Dashboard from './pages/Dashboard.jsx'
import History from './pages/History.jsx'
import WorkoutSession from './pages/WorkoutSession.jsx'

export default function App() {
  const { isAuthenticated, loginWithRedirect, logout, user, configured } = useAuth()
  const location = useLocation()
  // The workout session is meant to be immersive — full-screen camera, no
  // chrome around it — so it's the one route that hides the top bar
  // entirely rather than just styling it differently.
  const immersive = location.pathname === '/session'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-900 text-slate-100">
      {!immersive && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 md:flex-nowrap md:gap-4 md:px-8 md:pt-6">
            <div className="rounded-full border border-white/20 bg-white/10 px-5 py-2.5 shadow-lg backdrop-blur-xl md:flex-1 md:px-6 md:py-3">
              <Link to="/" className="whitespace-nowrap text-base font-bold text-white md:text-lg">
                Exerciser
              </Link>
            </div>
            <nav className="flex flex-1 items-center justify-end gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm shadow-lg backdrop-blur-xl md:flex-none md:gap-4 md:px-5 md:py-3">
              <Link to="/session" className="whitespace-nowrap text-white/80 hover:text-white">
                Start workout
              </Link>
              <Link to="/history" className="whitespace-nowrap text-white/80 hover:text-white">
                History
              </Link>
              {isAuthenticated ? (
                <button
                  onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                  className="whitespace-nowrap"
                >
                  Log out{user?.name ? ` (${user.name})` : ''}
                </button>
              ) : (
                <button
                  onClick={() => loginWithRedirect()}
                  disabled={!configured}
                  className="whitespace-nowrap rounded-full bg-brand-600 px-4 py-1.5 font-medium disabled:opacity-40"
                >
                  Log in
                </button>
              )}
            </nav>
          </div>

          {!configured && (
            <div className="mx-4 mt-4 shrink-0 rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-200 md:mx-8">
              Auth0 isn't configured yet — set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID in
              frontend/.env. See docs/SETUP.md.
            </div>
          )}
        </>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/session" element={<WorkoutSession />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>
    </div>
  )
}
