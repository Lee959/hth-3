# Architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + Tailwind CSS | Fast dev loop, responsive by default |
| Backend | Flask (Python) | Thin REST API, easy to bolt OpenCV/MediaPipe onto |
| Database | TigerData (Postgres + TimescaleDB) | Vitals are time-series data; hypertables partition/compress automatically |
| Auth | Auth0 (SPA + API) | Login/session handled for us, JWT verification on the backend |
| Live body tracking | MediaPipe Pose (BlazePose), running client-side via `@mediapipe/tasks-vision` | Real-time (30fps+) in the browser, no server round trip |
| Video capture / server-side CV | OpenCV (`opencv-python-headless`) + `mediapipe` (Python) | Decodes frames, available for server-side spot-checks or recorded-clip analysis |
| Exercise vitals (HR, breathing) | Presage Technologies SmartSpectra (Physiology REST API) | Contactless vitals from camera video |
| Muscle group UI | `react-body-highlighter` | Purpose-built SVG body model with per-muscle highlighting |

## The core design problem: one camera, two consumers

The brief flagged this directly: how do you get a single webcam feed to feed
**both** the pose-tracking pipeline (OpenCV/MediaPipe) **and** Presage's
vitals pipeline, without fighting over the camera or doubling latency?

**Answer: one `getUserMedia()` call, two consumers of the same `MediaStream`.**

```
                 ┌───────────────────────────┐
                 │   navigator.getUserMedia   │   (frontend/src/hooks/useCamera.js)
                 └─────────────┬─────────────┘
                               │  ONE MediaStream
                 ┌─────────────┴─────────────┐
                 ▼                           ▼
   ┌─────────────────────────┐   ┌─────────────────────────────┐
   │ <video> element          │   │ MediaRecorder (rolling       │
   │  -> MediaPipe Pose        │   │  ~20s .webm chunks)          │
   │     Landmarker (WASM,     │   │  -> POST /api/vitals/:id/    │
   │     in-browser, realtime) │   │     chunks (Flask)           │
   │  -> rep counting, form    │   │  -> Presage REST API         │
   │     feedback, muscle map  │   │     (upload -> poll -> HR/   │
   │     (no network hop)      │   │     breathing rate)          │
   └─────────────────────────┘   └─────────────────────────────┘
```

Why this works:
- The live `<video>` element and `MediaRecorder` can both attach to the
  *same* `MediaStream` object — the browser doesn't need a second camera
  handle. `useCamera()` (`frontend/src/hooks/useCamera.js`) is the single
  place that calls `getUserMedia`; everything else consumes its output.
- Pose tracking needs to be fast (every frame) and cheap, so it runs
  **entirely client-side** via MediaPipe's WASM build
  (`usePoseDetection.js`). No frames are ever sent to the server for this
  path.
- Presage's SmartSpectra SDK only ships as a native SDK (iOS/Android/C++/
  Node), not Python — so instead of embedding it in Flask, we use Presage's
  **Physiology REST API**: upload a short recorded clip, poll until it's
  processed, get back heart rate / breathing rate / HRV. That's inherently
  chunky (seconds of latency), which is fine for vitals but would be far
  too slow for rep counting — hence splitting the two pipelines apart in
  the first place.
- `useVitalsUpload.js` records rolling ~20s chunks (configurable) instead of
  one long recording, so the first vitals reading comes back well before
  the workout ends.

If a team member prefers server-side pose analysis (e.g. for a "form
replay" feature, or to validate the client-side rep count), the backend
also has an OpenCV + MediaPipe-Python module
(`backend/app/pose_engine/pose_estimator.py`) exposed at
`POST /api/pose/analyze-frame`. That path is optional — treat client-side
tracking as the primary, real-time pipeline.

## Backend layout (`backend/`)

```
backend/
  run.py                    # entrypoint: `python run.py`
  app/
    __init__.py             # app factory: create_app()
    config.py                # env-driven Config object
    extensions.py             # db (SQLAlchemy), migrate (Flask-Migrate)
    auth/
      decorators.py          # @requires_auth — verifies Auth0 JWTs via JWKS
    models/
      user.py                 # User (auth0_sub, email, display_name)
      workout.py               # WorkoutSession, ExerciseSet
      vitals.py                 # VitalsReading (hypertable candidate)
    routes/
      health.py                # GET /api/health
      workouts.py               # session + set CRUD
      vitals.py                  # chunk upload -> Presage -> stored reading
      pose.py                     # optional server-side pose analysis
    services/
      presage_client.py          # Presage REST API wrapper (upload/poll)
    pose_engine/
      pose_estimator.py           # OpenCV decode + MediaPipe Pose (server-side)
      rep_counter.py                # joint-angle state machine
      muscle_map.py                  # exercise name -> muscle groups
  sql/
    create_hypertable.sql            # run once against TigerData
  tests/
    test_health.py
```

`create_app()` takes a `Config` subclass so tests can swap in an in-memory
SQLite database and dummy Auth0 settings (`tests/test_health.py`).

## Frontend layout (`frontend/src`)

```
src/
  main.jsx                  # mounts <App/> inside BrowserRouter + AppAuthProvider
  App.jsx                    # nav, routes, login/logout button
  auth/
    AuthContext.jsx           # useAuth() — safe no-op default if Auth0 isn't configured
    Auth0ProviderWithNavigate.jsx  # wraps Auth0Provider, bridges into AuthContext
  hooks/
    useCamera.js                # the single getUserMedia() call (see above)
    usePoseDetection.js           # MediaPipe PoseLandmarker on the shared stream
    useVitalsUpload.js              # MediaRecorder chunks -> backend -> Presage
  components/
    CameraFeed.jsx                 # <video> element
    MuscleBodyMap.jsx                # react-body-highlighter wrapper
    RepCounter.jsx                    # big number + exercise name
    VitalsPanel.jsx                     # HR / breathing / HRV tiles
  pages/
    Dashboard.jsx                       # landing page
    WorkoutSession.jsx                    # wires camera + pose + vitals + UI together
    History.jsx                             # placeholder for past sessions
  services/
    api.js                                   # axios instance + auth-token interceptor
```

`useAuth()` always returns a valid shape (real Auth0 state if configured,
otherwise a safe fallback with `configured: false`), so components never
need to special-case "Auth0 isn't set up yet" beyond checking that flag.

## Data model

- **User** — one row per Auth0 subject (`auth0_sub`), created lazily on
  first authenticated request.
- **WorkoutSession** — one per workout (start/end timestamps).
- **ExerciseSet** — one row per logged set: exercise name, rep count, form
  score, and the muscle groups it trains (looked up via
  `pose_engine/muscle_map.py` so the same list of muscle names is used by
  both the DB and the `MuscleBodyMap` UI).
- **VitalsReading** — one row per Presage sample (heart rate, breathing
  rate, HRV). This is the time-series table: `backend/sql/create_hypertable.sql`
  turns it into a TimescaleDB hypertable partitioned on `recorded_at`. Note
  the composite primary key `(id, recorded_at)` in
  `backend/app/models/vitals.py` — Timescale requires the partitioning
  column to be part of every unique/primary-key constraint on a hypertable,
  so a plain auto-increment `id` alone won't work once it's converted.

## Auth flow

1. Frontend uses `@auth0/auth0-react`'s `Auth0Provider` (SPA login,
   Authorization Code + PKCE under the hood).
2. After login, the frontend requests an access token scoped to our API's
   `audience` and attaches it as `Authorization: Bearer <token>` on every
   API call (`services/api.js`).
3. The backend's `@requires_auth` decorator fetches Auth0's JWKS
   (`https://<domain>/.well-known/jwks.json`) and verifies the token's
   signature, audience, and issuer — no shared secret between frontend and
   backend.

## Presage integration flow

```
Flask receives chunk  --POST /v1/upload-url-->  Presage
                       <--presigned S3 URL------
Flask PUTs the clip    --PUT-------------------->  S3
Flask marks complete   --POST /v1/complete------>  Presage
Flask polls            --POST /retrieve-data---->  Presage
                       <--{status, pulse_rate,...}--
Flask stores a VitalsReading row, frontend polls GET /api/vitals/:id
```

**This exact request/response shape is a best-effort reading of Presage's
publicly documented API surface** (see `docs/SETUP.md` for the account
signup step). Before demo day, whoever owns the vitals integration should
confirm the real field names against `https://docs.physiology.presagetech.com/`
and an actual API key, and adjust `backend/app/services/presage_client.py`
+ `backend/app/routes/vitals.py` if they differ.
