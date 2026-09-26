import { useEffect, useState } from 'react'

import { useAuth } from '../auth/AuthContext.jsx'
import { api, attachAuthToken } from '../services/api.js'

/**
 * GETs an API path that needs a logged-in user. `status` is one of
 * 'signed-out' | 'loading' | 'error' | 'ready' so callers can pick the
 * right empty state — per-user data only exists once someone is logged in,
 * since everything is saved against their Auth0 account.
 *
 * While Auth0 isn't configured (dev mode) it fetches without a token: the
 * backend's DEV_USER_SUB answers as the demo user.
 */
export function useAuthedGet(path) {
  const { isAuthenticated, isLoading, getAccessTokenSilently, configured } = useAuth()
  const [state, setState] = useState({ status: 'loading', data: null })

  useEffect(() => {
    if (isLoading) return undefined
    if (configured && !isAuthenticated) {
      setState({ status: 'signed-out', data: null })
      return undefined
    }

    let cancelled = false
    if (isAuthenticated) attachAuthToken(getAccessTokenSilently)
    setState({ status: 'loading', data: null })
    api
      .get(path)
      .then((res) => !cancelled && setState({ status: 'ready', data: res.data }))
      .catch(() => !cancelled && setState({ status: 'error', data: null }))
    return () => {
      cancelled = true
    }
  }, [path, isAuthenticated, isLoading, getAccessTokenSilently, configured])

  return state
}
