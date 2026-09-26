import { createContext, useContext } from 'react'

// Default value doubles as the "Auth0 not configured yet" fallback so the
// rest of the app can call useAuth() unconditionally instead of branching
// on whether Auth0Provider is mounted.
export const AuthContext = createContext({
  isAuthenticated: false,
  isLoading: false,
  user: null,
  loginWithRedirect: () => {},
  logout: () => {},
  getAccessTokenSilently: async () => null,
  configured: false,
})

export function useAuth() {
  return useContext(AuthContext)
}
