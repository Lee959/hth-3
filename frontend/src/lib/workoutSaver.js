import { api, trackSave, whenSaved } from '../services/api.js'

// How many times ending a workout tries to save what's left, and the pause
// between tries (e.g. while the server or database is briefly down).
const SAVE_ATTEMPTS = 5
const RETRY_DELAY_MS = 5000

const SAVE_PATHS = {
  set: (id) => `/workouts/${id}/sets`,
  reading: (id) => `/vitals/${id}/readings`,
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Saves one workout to the database: what the home page's history and
 * summary are built from — its start and end times, its sets and its heart
 * rate readings (anything derived, like heart rate zones, is worked out
 * from these when read). Sets and readings go out as they're added;
 * anything added before the workout exists in the database, or whose
 * request failed, stays queued and goes out with the next one. end() sends
 * whatever is still queued, retrying for a while if that fails, then marks
 * the workout ended.
 *
 * Start and end times are the browser's (when the workout opened, when End
 * was pressed), the same clock heart rate readings are stamped with, so the
 * saved duration matches the summary screen's.
 */
export function createWorkoutSaver() {
  const startedAt = Date.now()
  // Earlier workouts still saving (their end() calls) — not this one's own,
  // which would wait on itself.
  const earlierSaves = whenSaved()
  let started = false
  let ended = false
  let sessionRequest = null
  let queue = []
  // Batches go out one after another, so end() waits for any on its way.
  let saving = Promise.resolve()

  // Resolves to the workout's id, creating it if that hasn't happened yet
  // (or failed). Waits for earlier workouts to finish saving first:
  // creating one closes any the user left open, which would cut short (or
  // delete, if none of it has landed yet) one that's still saving.
  function session() {
    if (!sessionRequest) {
      const request = earlierSaves
        .then(() => api.post('/workouts/', { started_at: new Date(startedAt).toISOString() }))
        .then((res) => res.data.id)
      sessionRequest = request
      request.catch((err) => {
        console.error('could not start workout session', err)
        if (sessionRequest === request) sessionRequest = null
      })
    }
    return sessionRequest
  }

  // Sends everything queued to workout `id`; whatever fails is queued again.
  function sendQueued(id) {
    const batch = queue
    queue = []
    return Promise.all(
      batch.map((item) =>
        api.post(SAVE_PATHS[item.type](id), item.body).catch((err) => {
          console.error(`could not save ${item.type}`, err)
          queue.push(item)
        }),
      ),
    )
  }

  function flush() {
    const request = session()
    saving = saving
      .then(() => request)
      .then(sendQueued)
      .catch(() => {}) // already logged; the queue keeps what didn't save
  }

  async function saveRest(endedAt) {
    let endSaved = false
    for (let attempt = 1; attempt <= SAVE_ATTEMPTS; attempt++) {
      if (attempt > 1) await wait(RETRY_DELAY_MS)
      try {
        const id = await session()
        await sendQueued(id)
        if (!endSaved) {
          await api.post(`/workouts/${id}/end`, { ended_at: new Date(endedAt).toISOString() })
          endSaved = true
        }
        if (queue.length === 0) return
      } catch (err) {
        console.error('could not end workout', err)
      }
    }
    console.error('gave up saving the workout', { endSaved, unsaved: queue })
  }

  return {
    startedAt,
    get ended() {
      return ended
    },
    /** Creates the workout in the database and saves what's added from now on. */
    start() {
      started = true
      flush()
    },
    /** Queues a set or heart rate reading (`type` 'set' | 'reading') to save. */
    add(type, body) {
      if (ended) return
      queue.push({ type, body })
      if (started) flush()
    },
    /**
     * Saves everything still queued, then marks the workout ended at
     * `endedAt`. Only the first call does anything, and only once started.
     * Tracked (trackSave), so pages reading workouts wait for it.
     */
    end(endedAt = Date.now()) {
      if (ended) return
      ended = true
      if (!started) return
      const done = saving.then(() => saveRest(endedAt))
      saving = done
      trackSave(done)
    },
  }
}
