import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import WorkoutDetailPanel from './WorkoutDetailPanel.jsx'
import { refreshAuthedData } from '../hooks/useAuthedGet.js'
import { useWorkoutHistory } from '../hooks/useWorkoutHistory.js'
import { api } from '../services/api.js'

// How long the panel lingers after the pointer leaves it, so a slightly
// sloppy mouse path back into it doesn't snap it shut.
const CLOSE_DELAY_MS = 250
// Extra room past the panel's right edge the pointer can wander into
// before it counts as having left.
const CLOSE_MARGIN_PX = 24

function ClockIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

function prettify(name) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function groupLabel(date, today) {
  const days = Math.round((startOfDay(today) - startOfDay(date)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'Previous 7 days'
  return 'Older'
}

/** Buckets sessions (already newest-first) under Today / Yesterday / … headers. */
function groupSessions(sessions) {
  const today = new Date()
  const groups = []
  for (const session of sessions) {
    const label = session.started_at ? groupLabel(new Date(session.started_at), today) : 'Older'
    const last = groups[groups.length - 1]
    if (last?.label === label) last.sessions.push(session)
    else groups.push({ label, sessions: [session] })
  }
  return groups
}

function describeSession(session, groupLabel) {
  const started = session.started_at ? new Date(session.started_at) : null
  const title = session.exercises?.length
    ? session.exercises.map(prettify).join(', ')
    : 'Workout'

  const details = []
  if (started) {
    const time = started.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    // Today/Yesterday headers already say which day it was; older ones don't.
    const recent = groupLabel === 'Today' || groupLabel === 'Yesterday'
    details.push(recent ? time : `${started.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`)
  }
  if (session.total_reps) details.push(`${session.total_reps} reps`)
  if (started && session.ended_at) {
    const minutes = Math.max(1, Math.round((new Date(session.ended_at) - started) / 60_000))
    details.push(`${minutes} min`)
  }
  return { title, details: details.join(' · ') }
}

function EmptyState({ status }) {
  const copy = {
    'signed-out': 'Log in to save your workouts — they’ll show up here.',
    loading: 'Loading your workouts…',
    error: 'Couldn’t load your history. Is the backend running?',
    ready: 'No workouts yet. Your sessions will show up here.',
  }[status]

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white/60">
        <ClockIcon className="h-5 w-5" />
      </span>
      <p className="font-rajdhani text-sm font-light leading-relaxed text-white/60">{copy}</p>
    </div>
  )
}

/**
 * Left-edge history drawer, modeled on Claude Code's session list: hidden
 * by default, slides out when the pointer reaches the left edge of the
 * screen (or the small tab there is clicked/tapped/focused — so it still
 * works on touch screens and from the keyboard), and tucks away again when
 * the pointer moves off to the right of it, Escape is pressed, or you click
 * elsewhere. Closing is judged by pointer position rather than mouseleave:
 * the panel slides in under a pointer that's already moving, and browsers
 * don't fire mouseenter for an element that moves under the cursor, so
 * hover events alone would snap it shut on a quick swipe off the edge.
 *
 * Clicking a workout opens its summary in WorkoutDetailPanel, filling the
 * screen to the right, and while that's open the drawer is locked open
 * too: pointer position and outside clicks no longer close it, and the
 * summary's close button (or Escape) puts both away together. Deleting a
 * workout happens from inside its summary.
 */
export default function HistorySidebar() {
  const { status, sessions: loadedSessions } = useWorkoutHistory()
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  // Hidden right away on delete, before the list reloads without them.
  const [deletedIds, setDeletedIds] = useState(() => new Set())
  const [deleteFailed, setDeleteFailed] = useState(false)
  const closeTimer = useRef(null)
  const panelRef = useRef(null)
  const tabRef = useRef(null)

  const sessions = loadedSessions.filter((s) => !deletedIds.has(s.id))
  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null
  const detailOpen = selectedSession != null

  const closeAll = useCallback(() => {
    setSelectedId(null)
    setOpen(false)
    tabRef.current?.focus()
  }, [])

  async function deleteSession(id) {
    setDeleteFailed(false)
    if (selectedId === id) setSelectedId(null)
    setDeletedIds((ids) => new Set(ids).add(id))
    try {
      await api.delete(`/workouts/${id}`)
    } catch (err) {
      // Already gone (deleted in another tab) is as good as deleted.
      if (err.response?.status !== 404) {
        setDeletedIds((ids) => {
          const next = new Set(ids)
          next.delete(id)
          return next
        })
        setDeleteFailed(true)
        return
      }
    }
    // The home page totals include it too.
    refreshAuthedData()
  }

  function show() {
    clearTimeout(closeTimer.current)
    setOpen(true)
  }

  function hideSoon() {
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
  }

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  useEffect(() => {
    if (!open) {
      setDeleteFailed(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    // Locked open while a workout's summary is showing.
    if (detailOpen) clearTimeout(closeTimer.current)
    function onKeyDown(event) {
      if (event.key === 'Escape') closeAll()
    }
    function onPointerDown(event) {
      if (detailOpen) return
      if (!panelRef.current?.contains(event.target) && !tabRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    function onMouseMove(event) {
      const panel = panelRef.current
      if (!panel || detailOpen) return
      // offsetLeft/offsetWidth ignore the slide-in transform, so this is the
      // panel's resting right edge even mid-animation.
      if (event.clientX > panel.offsetLeft + panel.offsetWidth + CLOSE_MARGIN_PX) hideSoon()
      else clearTimeout(closeTimer.current)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('mousemove', onMouseMove)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('mousemove', onMouseMove)
    }
  }, [open, detailOpen, closeAll])

  const groups = status === 'ready' ? groupSessions(sessions) : []
  const count = status === 'ready' ? sessions.length : 0

  return (
    <>
      {/* Invisible hot zone along the left edge — reaching it opens the panel. */}
      <div
        aria-hidden="true"
        className="fixed inset-y-0 left-0 z-30 w-3"
        onMouseEnter={show}
      />

      {/* The little "there's history over here" hint tab. */}
      <button
        ref={tabRef}
        type="button"
        onMouseEnter={show}
        onClick={() => (open ? setOpen(false) : show())}
        aria-expanded={open}
        aria-controls="history-sidebar"
        aria-label={count ? `Workout history, ${count} sessions` : 'Workout history'}
        className={`liquid-glass fixed left-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-2 rounded-l-none rounded-r-2xl border-l-0 px-1.5 py-4 text-white/70 transition duration-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60 ${
          open ? 'pointer-events-none -translate-x-full opacity-0' : 'opacity-100'
        }`}
      >
        <ClockIcon />
        {count > 0 && (
          <span className="rounded-full bg-rose-400 px-1.5 font-rajdhani text-[11px] font-bold leading-4 text-slate-950">
            {count > 99 ? '99+' : count}
          </span>
        )}
        <ChevronIcon />
      </button>

      {/* The dark tint under the glass (here and on the summary panel) keeps
          the dashboard's bright cards behind from washing it out. */}
      <aside
        id="history-sidebar"
        ref={panelRef}
        aria-label="Workout history"
        onFocus={show}
        className={`liquid-glass fixed inset-y-3 left-3 z-40 flex w-72 max-w-[calc(100vw-1.5rem)] flex-col rounded-3xl bg-[#07060d]/25 transition-[transform,opacity,visibility] duration-300 ease-out motion-reduce:transition-none ${
          open ? 'visible translate-x-0 opacity-100' : 'invisible -translate-x-[110%] opacity-0'
        }`}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h2 className="flex items-center gap-2 font-rajdhani text-base font-bold uppercase tracking-wide text-white">
            <ClockIcon />
            History
          </h2>
          {count > 0 && (
            <span className="font-rajdhani text-xs font-light uppercase tracking-wide text-white/50">
              {count} {count === 1 ? 'session' : 'sessions'}
            </span>
          )}
        </div>
        <div className="mx-5 h-px bg-white/10" />

        {deleteFailed && (
          <p role="alert" className="mx-3 mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 font-rajdhani text-xs text-amber-100/90">
            Couldn’t delete that workout. Try again?
          </p>
        )}

        {groups.length === 0 ? (
          <EmptyState status={status} />
        ) : (
          <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            {groups.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="px-3 pb-1 font-rajdhani text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.sessions.map((session) => {
                    const { title, details } = describeSession(session, group.label)
                    const selected = session.id === selectedId
                    return (
                      <li key={session.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(session.id)}
                          aria-current={selected ? 'true' : undefined}
                          className={`block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/60 ${
                            selected ? 'bg-white/10' : ''
                          }`}
                        >
                          <p className="truncate font-rajdhani text-sm font-semibold text-white/90">{title}</p>
                          {details && (
                            <p className="truncate font-rajdhani text-xs font-light text-white/50">{details}</p>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        )}

        <div className="p-3">
          <Link
            to="/history"
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-white/10 py-2.5 font-rajdhani text-sm font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/15 hover:text-white"
          >
            View all history
            <ChevronIcon />
          </Link>
        </div>
      </aside>

      <WorkoutDetailPanel
        session={selectedSession}
        onClose={closeAll}
        onDelete={deleteSession}
      />
    </>
  )
}
