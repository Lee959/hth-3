import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
})

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
