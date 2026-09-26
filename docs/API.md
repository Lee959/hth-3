# API Reference

Base URL (dev): `http://localhost:5000/api`. All routes except
`/health` require `Authorization: Bearer <auth0-access-token>`.

## Health

### `GET /health`
No auth. Returns `{"status": "ok"}`.

## Workouts

### `POST /workouts/`
Starts a new session for the authenticated user (creates the `User` row on
first call). Returns the new `WorkoutSession`.

```json
{ "id": 1, "user_id": 1, "started_at": "2026-09-25T18:00:00+00:00", "ended_at": null }
```

### `POST /workouts/<session_id>/end`
Sets `ended_at` on the session. Returns the updated `WorkoutSession`.

### `POST /workouts/<session_id>/sets`
Logs one completed exercise set.

Request body:
```json
{ "exercise_name": "squat", "reps": 12, "form_score": 0.87 }
```
`muscle_groups` is filled in server-side from
`backend/app/pose_engine/muscle_map.py` based on `exercise_name`.

### `GET /workouts/<session_id>`
Returns the session with its nested `exercise_sets`.

## Vitals

### `POST /vitals/<session_id>/chunks`
Multipart upload, field name `chunk` — one recorded video clip (`.webm`).
Forwards it to Presage, stores and returns the resulting `VitalsReading`.
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
