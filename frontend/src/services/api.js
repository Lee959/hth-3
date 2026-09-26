import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
})

// Workout saves still on their way (lib/workoutSaver.js). Reading workout
// data waits for them (useAuthedGet), so a page opened right after a
// workout ends shows it; a new workout is only created once they're done.
const pendingSaves = new Set()

export function trackSave(promise) {
  pendingSaves.add(promise)
  const settle = () => pendingSaves.delete(promise)
  promise.then(settle, settle)
}

/** Resolves once every save tracked so far has finished (or given up). */
export function whenSaved() {
  return Promise.allSettled([...pendingSaves])
}

let authInterceptor = null

// Safe to call from every page that needs auth: replaces any interceptor a
// previous page attached instead of stacking another one on each visit.
export function attachAuthToken(getAccessTokenSilently) {
  if (authInterceptor !== null) api.interceptors.request.eject(authInterceptor)
  authInterceptor = api.interceptors.request.use(async (config) => {
    try {
      const token = await getAccessTokenSilently()
      if (token) config.headers.Authorization = `Bearer ${token}`
    } catch {
      // no active session yet; request goes out unauthenticated
    }
    return config
  })
}
