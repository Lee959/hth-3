import { useEffect, useState } from 'react'

import { useAuth } from '../auth/AuthContext.jsx'
import { api, attachAuthToken, whenSaved } from '../services/api.js'

// The last response for each user + path ("stale-while-revalidate"): coming
// back to a page, or reloading it, shows that at once while a fresh copy
// loads in the background, instead of an empty page for the second or more
// each request takes over a slow link. sessionStorage keeps it across
// reloads in this tab only, and it's gone when the tab closes.
const CACHE_PREFIX = 'authedGet:'

// How long to wait for a workout that's still saving before loading
// anyway (it loads again once the save is done).
const SAVE_WAIT_MS = 10000

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(key, data) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data))
  } catch {
    // storage full or blocked: just don't cache
  }
}

/**
 * GETs an API path that needs a logged-in user. `status` is one of
 * 'signed-out' | 'loading' | 'error' | 'ready' so callers can pick the
 * right empty state — per-user data only exists once someone is logged in,
 * since everything is saved against their Auth0 account.
 *
 * While Auth0 isn't configured (dev mode) it fetches without a token: the
 * backend's DEV_USER_SUB answers as the demo user.
 *
 * Shows the last cached response right away (status 'ready') and replaces
 * it when the fresh one arrives; if that request fails, the cached data
 * stays up (ConnectionWarning tells the user the connection is down).
 *
 * Loads once any workout still saving (lib/workoutSaver.js) is saved, so
 * coming back from a workout shows it.
 */
export function useAuthedGet(path) {
  const { isAuthenticated, isLoading, getAccessTokenSilently, configured, user } = useAuth()
  const [state, setState] = useState({ status: 'loading', data: null })

  useEffect(() => {
    if (isLoading) return undefined
    if (configured && !isAuthenticated) {
      setState({ status: 'signed-out', data: null })
      return undefined
    }

    let cancelled = false
    if (isAuthenticated) attachAuthToken(getAccessTokenSilently)
    const cacheKey = `${user?.sub ?? 'dev-user'}:${path}`
    let cached = readCache(cacheKey)
    setState(cached != null ? { status: 'ready', data: cached } : { status: 'loading', data: null })
    function load() {
      if (cancelled) return
      api
        .get(path)
        .then((res) => {
          writeCache(cacheKey, res.data)
          cached = res.data
          if (!cancelled) setState({ status: 'ready', data: res.data })
        })
        .catch(() => {
          if (!cancelled && cached == null) setState({ status: 'error', data: null })
        })
    }
    const timer = setTimeout(load, SAVE_WAIT_MS)
    whenSaved().then(() => {
      clearTimeout(timer)
      load()
    })
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [path, isAuthenticated, isLoading, getAccessTokenSilently, configured, user?.sub])

  return state
}
