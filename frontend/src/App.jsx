import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'

import { useAuth } from './auth/AuthContext.jsx'
import AmbientBackground from './components/AmbientBackground.jsx'
import ConnectionWarning from './components/ConnectionWarning.jsx'
import { useCameraBackdrop } from './hooks/useCameraBackdrop.js'
import Dashboard from './pages/Dashboard.jsx'
import History from './pages/History.jsx'
import Landing from './pages/Landing.jsx'
import Register from './pages/Register.jsx'
import SignIn from './pages/SignIn.jsx'
import WorkoutSession from './pages/WorkoutSession.jsx'

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  )
}

function CameraOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
      <path d="M1 1l22 22" />
    </svg>
  )
}

const CAMERA_TITLES = {
  off: 'Camera background: off',
  starting: 'Starting camera…',
  live: 'Camera background: on',
  blocked: 'Camera is blocked — allow camera access in your browser’s site settings',
  unavailable: 'No camera available (or it’s in use by another app)',
}

function navLinkClass({ isActive }) {
  return `whitespace-nowrap rounded-full px-3 py-1.5 transition ${
    isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white'
  }`
}

export default function App() {
  const { isAuthenticated, loginWithRedirect, logout, user, configured } = useAuth()
  const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN
  const canStartAuth = configured || Boolean(auth0Domain)
  const location = useLocation()
  // The workout session is meant to be immersive — full-screen camera, no
  // chrome around it — so it's the one route that hides the top bar
  // entirely rather than just styling it differently.
  const immersive = location.pathname === '/session'
  const camera = useCameraBackdrop({ active: !immersive })
  const cameraProblem = camera.enabled && (camera.status === 'blocked' || camera.status === 'unavailable')

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#07060d] text-slate-100">
      {!immersive && (
        <>
          <AmbientBackground stream={camera.stream} />
          <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 p-4 md:flex-nowrap md:gap-4 md:px-8 md:pt-6">
            <Link
              to="/"
              className="liquid-glass flex items-center gap-2.5 rounded-full px-5 py-2.5 md:px-6 md:py-3"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-rose-300 to-rose-500 shadow-[0_0_12px_rgba(251,113,133,0.8)]" />
              <span className="whitespace-nowrap font-rajdhani text-lg font-bold tracking-wide text-white">
                account<span className="text-rose-400">ABLE</span>
              </span>
            </Link>
            <nav className="liquid-glass flex items-center gap-1 rounded-full p-1.5 font-rajdhani text-sm font-semibold uppercase tracking-wide">
              <button
                type="button"
                onClick={camera.toggle}
                aria-pressed={camera.enabled}
                aria-label="Camera background"
                title={camera.enabled ? CAMERA_TITLES[camera.status] : CAMERA_TITLES.off}
                className={`relative flex h-8 w-8 items-center justify-center rounded-full transition ${
                  camera.status === 'live' ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                {camera.status === 'live' || camera.status === 'starting' ? <CameraIcon /> : <CameraOffIcon />}
                {camera.status === 'live' && (
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.9)]" />
                )}
                {cameraProblem && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-300" />}
              </button>
              <NavLink to="/session" className={navLinkClass}>
                Workout
              </NavLink>
              <NavLink to="/dashboard" className={navLinkClass}>
                Dashboard
              </NavLink>
              {isAuthenticated ? (
                <button
                  onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                  className="whitespace-nowrap rounded-full px-3 py-1.5 text-white/70 transition hover:text-white"
                >
                  Log out{user?.name ? ` (${user.name})` : ''}
                </button>
              ) : (
                <button
                  onClick={async () => {
                    if (configured) {
                      await loginWithRedirect()
                      return
                    }
                    if (auth0Domain) window.location.assign(`https://${auth0Domain}/u/login`)
                  }}
                  disabled={!canStartAuth}
                  title={canStartAuth ? undefined : 'Log in needs Auth0 configured — see docs/SETUP.md'}
                  className="whitespace-nowrap rounded-full bg-white px-4 py-1.5 text-slate-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50"
                >
                  Log in
                </button>
              )}
            </nav>
          </header>

          {!configured && (
            <div className="relative z-10 mx-4 flex shrink-0 items-center justify-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-center text-xs text-amber-100/90 backdrop-blur-xl md:mx-auto md:max-w-fit">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
              Dev mode — Auth0 isn't configured, so you're seeing the demo user's data from the
              database. See docs/SETUP.md to enable log in.
            </div>
          )}
          <ConnectionWarning className="relative z-10 mx-4 mt-2 shrink-0 md:mx-auto md:max-w-fit" />
        </>
      )}

      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/register" element={<Register />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/session" element={<WorkoutSession />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>
    </div>
  )
}
