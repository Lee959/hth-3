import { useEffect, useState } from 'react'

import { api } from '../services/api.js'

const CHECK_EVERY_MS = 10000
// Over a slow link (e.g. a VPN) one check can take several seconds, and a
// single miss is usually a hiccup, not an outage: warn after two in a row.
const CHECK_TIMEOUT_MS = 15000
const FAILURES_BEFORE_WARNING = 2

const MESSAGES = {
  server: "Can't reach the server",
  database: 'Lost connection to the database',
}

/**
 * Warns when workouts can't be saved: polls the backend's /api/health,
 * which also checks the database, and says which of the two is out.
 * Renders nothing while both are fine; clears itself once they're back.
 */
export default function ConnectionWarning({ className = '' }) {
  const [problem, setProblem] = useState(null)

  useEffect(() => {
    let cancelled = false
    let failures = 0
    function check() {
      api
        .get('/health', { timeout: CHECK_TIMEOUT_MS })
        .then(() => {
          if (cancelled) return
          failures = 0
          setProblem(null)
        })
        .catch((err) => {
          if (cancelled || ++failures < FAILURES_BEFORE_WARNING) return
          const databaseDown = err.response?.status === 503 && err.response.data?.database === 'unreachable'
          setProblem(databaseDown ? 'database' : 'server')
        })
    }
    check()
    const interval = setInterval(check, CHECK_EVERY_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (!problem) return null
  return (
    <div
      role="alert"
      className={`flex items-center justify-center gap-2 rounded-full border border-rose-300/30 bg-rose-500/20 px-4 py-2 text-center text-xs text-rose-100 backdrop-blur-xl ${className}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-rose-300" />
      {MESSAGES[problem]}. Workouts won't save until it's back; retrying…
    </div>
  )
}
