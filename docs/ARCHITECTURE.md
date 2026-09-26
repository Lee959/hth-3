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
| Muscle group UI | [`@musclemap/react`](https://github.com/Jsplice/MuscleMap) | 0-100 per-muscle LOAD heatmap (front+back SVG bodies), not just a binary highlight |
| UI style | "Liquid glass" — frosted `bg-white/10 backdrop-blur-xl` cards over a gradient background | Matches the reference design the team picked; see [Design](#design-liquid-glass) |

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
      muscle_map.py                  # exercise name -> muscle groups (MuscleGroup enum names)
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
  App.jsx                    # gradient background, glass nav, routes, login/logout button
  auth/
    AuthContext.jsx           # useAuth() — safe no-op default if Auth0 isn't configured
    Auth0ProviderWithNavigate.jsx  # wraps Auth0Provider, bridges into AuthContext
  lib/
    poseMath.js                # landmark indices, angle-at-a-joint math, EMA smoothing
    repCounter.js                # generic angle-based rep state machine (up/down)
    muscleMap.js                   # exercise -> { MUSCLE_GROUP: weight } for the heatmap
  hooks/
    useCamera.js                     # the single getUserMedia() call (see above)
    usePoseDetection.js                # MediaPipe PoseLandmarker on the shared stream
    useExerciseTracker.js                # landmarks -> exercise/reps/muscle LOAD scores/speed
    useVitalsUpload.js                     # MediaRecorder chunks -> backend -> Presage
  components/
    CameraFeed.jsx                 # <video> element, glass frame
    MuscleHeatmap.jsx                # @musclemap/react wrapper (LOAD color model)
    GaugeRing.jsx                      # SVG ring gauge (heart rate zone, rep goal)
    MetricsSidebar.jsx                   # left sidebar: gauges, stat pills, quick actions
    RepCounter.jsx                         # big number + exercise name
  pages/
    Dashboard.jsx                       # landing page
    WorkoutSession.jsx                    # wires camera + pose + tracker + sidebar together
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
  `pose_engine/muscle_map.py`, using the same `MuscleGroup` enum names as
  `@musclemap/react` on the frontend).
- **VitalsReading** — one row per Presage sample (heart rate, breathing
  rate, HRV). This is the time-series table: `backend/sql/create_hypertable.sql`
  turns it into a TimescaleDB hypertable partitioned on `recorded_at`. Note
  the composite primary key `(id, recorded_at)` in
  `backend/app/models/vitals.py` — Timescale requires the partitioning
  column to be part of every unique/primary-key constraint on a hypertable,
  so a plain auto-increment `id` alone won't work once it's converted.

## Live exercise tracking & the muscle heatmap

`useExerciseTracker.js` (frontend) turns the raw MediaPipe landmarks into
everything the session page shows, entirely client-side:

1. Every frame, it computes four joint angles via `lib/poseMath.js`: knee
   (hip-knee-ankle), elbow (shoulder-elbow-wrist), shoulder/arm-raise
   (hip-shoulder-elbow), and hip-flexion (knee-hip-shoulder).
2. It classifies which of 5 exercises is happening — squat (knee),
   jumping_jack (shoulder), crunch (hip-flexion), or bicep_curl/push_up
   (elbow, disambiguated by torso orientation: horizontal => push-up). See
   the hook's own doc comment before adding a 6th one that doesn't reduce
   to "one joint angle swings between extended and bent." Thresholds are
   calibrated against the validated values in
   [Pushtogithub23/Tracking-Physical-Activities-with-MediaPipe-and-OpenCV](https://github.com/Pushtogithub23/Tracking-Physical-Activities-with-MediaPipe-and-OpenCV),
   widened in a few spots for jitter resistance on a live feed. Bench press
   from that repo isn't included — it assumes an overhead camera looking
   down at someone lying on a bench, a different physical setup than a
   front-facing standing webcam; its step-counting and jump-rope trackers
   aren't muscle-targeted exercises either, so they don't fit the LOAD
   heatmap this hook feeds.
3. **Classification is sticky, via an active/resting phase state machine —
   this is what kills flicker.** Once an exercise is active, every
   subsequent frame only asks "is *this* exercise's own angle still
   swinging enough?" — it never re-compares against the other 3 candidates
   mid-set. All 4 candidates are only re-scanned when coming out of rest.
   Without this, a couple of frames where one candidate's rolling window
   still held residual range from the previous rep (or the tail of the
   previous exercise) could steal the classification for a frame or two,
   which read as the exercise label flickering between labels.
4. When the active exercise's own range finally drops below the
   swing-detection threshold, the set is over: `lib/repCounter.js`'s
   up/down state machine's final rep count is logged into `completedSets`
   (see below), the muscle heatmap wipes, and the hook enters `resting`
   with a stopwatch (`RepCounter.jsx` switches from showing rep count to
   showing elapsed rest time). The stopwatch ticks on its own `setInterval`
   rather than off the pose-detection framerate, so it keeps counting even
   if MediaPipe stops producing frames (e.g. the person steps out of frame).
   **Every time an exercise resumes from rest — even the same exercise as
   before — its rep counter restarts at 0.** A "set" is exactly one
   continuous burst of activity between two rest periods.
5. **Entering activity is guarded too, but not by a timer or a windowed
   range check.** A candidate detected while resting becomes `pending`, not
   immediately `active`, and the UI keeps showing Resting until it's
   confirmed. Confirmation fires the instant the candidate's angle actually
   reaches that exercise's genuine range of motion (`EXERTION_STATE` in the
   hook — a real knee bend past 100°, a real elbow curl past 30°, arms
   actually raised for a jack), not merely "moved more than a noise
   threshold." A generic "has this been swinging for N ms" check was tried
   first and didn't work: it can't tell a brief incidental movement (a hand
   twitch, adjusting stance) from the first half of a real rep, since both
   look identical to a windowed range check for as long as the window still
   remembers the swing — and shrinking the window to make twitches decay
   faster broke real reps instead, misreading the natural near-zero-
   velocity moment at the top/bottom of every rep as "stopped." Tying
   confirmation to a concrete milestone side-steps both failure modes.
   `CONFIRM_DELAY_MS` is a ceiling, not a wait: if a candidate never reaches
   that genuine range within it, it's discarded entirely (including any rep
   it was silently counting), as if it never happened.
6. **Set tracking infrastructure:** each closed set (`{exerciseName, reps,
   completedAt}`) is appended to `completedSets`, which `WorkoutSession.jsx`
   watches and persists via `POST /api/workouts/:id/sets` — the endpoint
   already existed on the backend but nothing called it until now.
   `SetHistory.jsx` renders that same list locally as a quick "sets this
   session" readout. This is intentionally minimal (no editing, no set
   targets/goals yet) — a foundation for a real sets UI on the History
   page, not the whole feature.
7. Within one exercise, every completed rep adds LOAD points to that
   exercise's muscles via `lib/muscleMap.js`'s weight table (capped at 100,
   decaying slowly when idle) — so the heatmap reflects accumulated effort
   for the *current set*, matching `@musclemap/react`'s LOAD color model.
   `MuscleHeatmap.jsx` renders that score map directly.
8. The same landmark stream feeds a simple velocity/acceleration estimate
   (position delta / time, EMA-smoothed) shown as "Speed" / "Peak accel" in
   the sidebar — relative units (fraction of frame size per second), not
   calibrated to real-world meters. See the hook's doc comment for why.

## Design: "Liquid Glass"

The UI follows a frosted-glass look: `bg-white/10 backdrop-blur-xl border
border-white/20` cards over a `from-indigo-950 via-violet-900
to-fuchsia-900` gradient background, white text, rounded-full nav/buttons,
and `GaugeRing.jsx` ring gauges for at-a-glance percentages (heart-rate
zone, rep-goal progress). All metrics — gauges, stat pills, and the
Reset/Pause/History/End quick actions — live in `MetricsSidebar.jsx` on the
left; the camera feed, rep counter, and muscle heatmap fill the rest of the
page. Extending the look (new pages, new cards) means reusing that same
`rounded-3xl border border-white/20 bg-white/10 shadow-lg backdrop-blur-xl`
combination rather than introducing a second style.

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
