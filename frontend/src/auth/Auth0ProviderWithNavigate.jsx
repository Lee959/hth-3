import { Auth0Provider, useAuth0 } from '@auth0/auth0-react'
import { useNavigate } from 'react-router-dom'

import { AuthContext } from './AuthContext.jsx'

function Auth0Bridge({ children }) {
  const auth0 = useAuth0()
  return <AuthContext.Provider value={{ ...auth0, configured: true }}>{children}</AuthContext.Provider>
}

/**
 * Wraps the app in Auth0Provider and forwards its state into our own
 * AuthContext. If Auth0 env vars aren't set yet, renders children directly
 * so useAuth() falls back to AuthContext's safe default instead of the app
 * crashing on a missing domain/clientId.
 */
export function AppAuthProvider({ children }) {
  const navigate = useNavigate()
  const domain = import.meta.env.VITE_AUTH0_DOMAIN
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE

  if (!domain || !clientId) {
    return children
  }

  const onRedirectCallback = (appState) => {
    navigate(appState?.returnTo || window.location.pathname)
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{ redirect_uri: window.location.origin, audience }}
      onRedirectCallback={onRedirectCallback}
    >
      <Auth0Bridge>{children}</Auth0Bridge>
    </Auth0Provider>
  )
}
