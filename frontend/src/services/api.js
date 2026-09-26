import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
})

export function attachAuthToken(getAccessTokenSilently) {
  api.interceptors.request.use(async (config) => {
    try {
      const token = await getAccessTokenSilently()
      if (token) config.headers.Authorization = `Bearer ${token}`
    } catch {
      // no active session yet; request goes out unauthenticated
    }
    return config
  })
}
