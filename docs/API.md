# API Reference

Base URL (dev): `http://localhost:5050/api`. All routes except
`/health` require `Authorization: Bearer <auth0-access-token>`.

## Health

### `GET /health`
No auth. Returns `{"status": "ok"}`.

## Workouts

Timestamps sent by the client may be ISO 8601 strings (`toISOString()`) or
Unix epoch milliseconds (`Date.now()`); responses are always ISO 8601 UTC.

### `GET /workouts/`
The user's workout history, newest first. Page through all of it with
`?limit=` (default 50, max 500) and `?offset=`; the total count is in the
`X-Total-Count` response header. Each item is a `WorkoutSession` plus
`total_reps` and `exercises` (names done in that workout).

### `POST /workouts/`
Starts a new session for the authenticated user (creates the `User` row on
first call). Optional body `{ "started_at": ... }`, defaulting to now.
Returns the new `WorkoutSession`:

```json
{ "id": 1, "user_id": 1, "started_at": "2026-09-25T18:00:00+00:00", "ended_at": null,
  "status": "active", "duration_sec": null, "total_reps": null,
  "avg_heart_rate_bpm": null, "max_heart_rate_bpm": null, "zone_minutes": null,
  "form_score": null, "effort_score": null }
```

### `POST /workouts/<session_id>/end`
Sets `ended_at` (optional body `{ "ended_at": ... }`, defaulting to now),
`duration_sec` and `status: "ended"`. Returns the updated
`WorkoutSession`; ending an already-ended session returns it unchanged.

### `POST /workouts/<session_id>/sets`
Logs one completed exercise set, optionally with its individual reps.

Request body (everything except `exercise_name` optional):
```json
{
  "exercise_name": "squat", "reps": 12,
  "form_score": 82.5, "range_of_motion": 88, "symmetry": 91, "avg_rep_seconds": 2.3,
  "started_at": "2026-09-25T18:01:00Z", "ended_at": "2026-09-25T18:01:30Z",
  "rep_events": [
    { "recorded_at": "2026-09-25T18:01:03Z", "range_of_motion": 86, "symmetry": 90,
      "tempo_score": 100, "rep_seconds": 2.4, "form_score": 87.3 }
  ]
}
```
`muscle_groups` is filled in server-side from
`backend/app/pose_engine/muscle_map.py` based on `exercise_name`.
`rep_events` are numbered in the order given and stored in the
`rep_events` hypertable, linked to the new set.

### `GET /workouts/<session_id>`
One workout in full: the `WorkoutSession` fields plus `exercise_sets`,
`vitals` and `rep_events`, each in time order.

## Vitals

### `POST /vitals/<session_id>/chunks`
Multipart upload, field name `chunk` — one recorded video clip (`.webm`).
Forwards it to Presage, stores and returns the resulting `VitalsReading`.
Optional form fields `started_at` and `duration_sec` say when the clip was
filmed; the reading's `recorded_at` is the clip start and `window_sec` its
length. Without them the clip is assumed to be 20s long and to have ended
when the upload arrived.
This endpoint is synchronous (it waits on Presage's poll loop), so expect
it to take a few seconds.

### `GET /vitals/<session_id>`
Returns up to the 50 most recent `VitalsReading` rows for the session,
newest first.

## Pose (optional, server-side)

### `POST /pose/analyze-frame`
Multipart upload, field name `frame` — one JPEG image. Returns MediaPipe
Pose landmarks for that frame, or `422` if no person was detected. Meant
for spot-checks / recorded-clip analysis; the primary real-time tracking
path is entirely client-side (see `frontend/src/hooks/usePoseDetection.js`)
and does not go through this endpoint.
