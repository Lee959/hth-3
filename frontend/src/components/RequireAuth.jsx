import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext.jsx'

/**
 * Route guard for /dashboard, /session, and /history — the app's actual
 * user data. While Auth0 isn't configured (`configured: false`, the local
 * "no .env yet" fallback — see AuthContext.jsx), every route stays open
 * and the backend answers as DEV_USER_SUB instead; the guard only starts
 * enforcing once real login is wired up, so it doesn't lock developers out
 * before they've set up Auth0.
 *
 * Redirects to /signin rather than rendering an inline "please log in"
 * message, carrying the attempted location in router state so SignIn.jsx
 * can send the user back where they meant to go once they're
 * authenticated (see its own `loginWithRedirect` call).
 */
export default function RequireAuth({ children }) {
  const { isAuthenticated, isLoading, configured } = useAuth()
  const location = useLocation()

  if (!configured) return children
  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/signin" state={{ from: location }} replace />
  return children
}
