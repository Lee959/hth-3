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
    muscleMap.js                   # exercise -> { MUSCLE_GROUP: weight }; LOAD_PER_REP; summaryScoresFor()
    heartRateZones.js                # shared HR zone model (live gauge + session summary)
    workoutSummary.js                  # builds/[stub] persists the Workout Saved snapshot
  hooks/
    useCamera.js                     # the single getUserMedia() call (see above)
    usePoseDetection.js                # MediaPipe PoseLandmarker on the shared stream
    useExerciseTracker.js                # landmarks -> exercise/reps/muscle LOAD scores/speed/totalRestMs
    useVitalsUpload.js                     # MediaRecorder chunks -> backend -> Presage
    useCameraPalette.js                       # ported from dev/metrics-board; feeds AmbientBackground.jsx
  components/
    CameraFeed.jsx                 # <video> element, glass frame
    MuscleHeatmap.jsx                # @musclemap/react wrapper (LOAD color model), view="FRONT"|"BACK"
    GaugeRing.jsx                      # SVG ring gauge (heart rate zone, rep goal)
    MetricsSidebar.jsx                   # left sidebar: gauges, stat pills, quick actions
    RepCounter.jsx                         # big number + exercise name
    WorkoutSummary.jsx                       # full-screen "Workout Saved" pop-out shown on End Workout
    AmbientBackground.jsx                      # ported from dev/metrics-board; WorkoutSummary's backdrop
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
   (see below), the muscle heatmap wipes, and the hook enters `resting`.
   `RestTimer.jsx` (a separate component from `RepCounter.jsx` — see the
   layout section below) appears top-middle showing elapsed rest time,
   ticking on its own `setInterval` rather than off the pose-detection
   framerate, so it keeps counting even if MediaPipe stops producing frames
   (e.g. the person steps out of frame). **Every time an exercise resumes
   from rest — even the same exercise as before — its rep counter restarts
   at 0.** A "set" is exactly one continuous burst of activity between two
   rest periods.
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
   `completedSets` is **not** rendered live anywhere in the session HUD —
   an earlier version had a `SetHistory.jsx` tile in the right-hand column
   for this, but five tiles vertically centered in that column could run
   past a short mobile viewport and forced an internal scrollbar (see the
   layout section below); rather than just tolerating that scrollbar, the
   whole live session view now only shows the four *current-set* tiles, and
   every session-level stat (sets, duration, rest, avg HR) is deferred to
   the `WorkoutSummary.jsx` pop-out on End Workout instead (see below), so
   nothing there needs to scroll.
7. `totalRestMs` (returned by the hook alongside `restElapsedMs`) is the sum
   of every *finished* rest period this session, not just the current one —
   `restElapsedMs` resets to 0 each time a new set starts; `totalRestMs`
   doesn't. It's folded in at the one place a rest period actually ends
   (the pending→active graduation branch, where the hook adds `now -
   restStartedAt.current` before clearing `restStartedAt`), plus whatever
   of the *current* rest period has elapsed so far, so it's always
   accurate to read at any point — including mid-rest, which is what lets
   `WorkoutSession.jsx` grab it synchronously in `handleEndSession` without
   waiting for a tick.
8. Within one exercise, every completed rep adds LOAD points to that
   exercise's muscles via `lib/muscleMap.js`'s weight table (capped at 100,
   decaying slowly when idle) — so the heatmap reflects accumulated effort
   for the *current set*, matching `@musclemap/react`'s LOAD color model.
   `MuscleHeatmap.jsx` renders that score map directly.
9. The same landmark stream feeds a simple velocity/acceleration estimate
   (position delta / time, EMA-smoothed) — relative units (fraction of
   frame size per second), not calibrated to real-world meters. See the
   hook's doc comment for why. `useExerciseTracker` still computes and
   returns `speed`/`peakAcceleration`; `MetricsSidebar.jsx` no longer
   renders them (dropped as HUD noise), so nothing currently reads them.

## Workout Saved summary (`WorkoutSummary.jsx`)

Shown as a full-screen pop-out over the session HUD (`absolute inset-0
z-30`) when the user hits End Workout — visual-only for now, per explicit
scope: no backend persistence, just a clearly-marked stub (see below).

**Background and tile style are ported from `dev/metrics-board`'s Dashboard
redesign** (a separate branch's "metrics board" — not this branch's own
`MetricsSidebar.jsx`, an earlier, since-superseded pass at matching that),
rather than either this app's purple page gradient or the immersive
session's flat black:

- **`AmbientBackground.jsx`** (copied over, along with its
  `useCameraPalette.js` hook, unmodified) — three blurred, slowly drifting
  color glows over a near-black `bg-[#07060d]`, colored from the live
  camera feed if `stream` is passed (still-open from the session even after
  End Workout, since only pose detection paused, not the camera itself) or
  a fixed fallback palette otherwise. Purely decorative (`aria-hidden`),
  rendered once behind the summary's content (`relative z-10`).
- **`.liquid-glass`** (new utility class in `styles/index.css`, also ported
  unmodified) — a richer glass surface than `GlassTile.jsx`'s flat
  `bg-white/10`: a diagonal sheen gradient, saturated blur so the ambient
  glows tint through it, and an inner highlight so tiles read as curved,
  light-catching slabs. `WorkoutSummary.jsx`'s title, stat tiles, the
  load-legend pill, the exercises table, and the Home/New Workout buttons
  all use it (`rounded-3xl` for boxy tiles, `rounded-full` for pills) —
  `MuscleHeatmap.jsx` keeps its own `GlassTile`, since that component is
  shared with the live HUD and wasn't in scope for this pass.
- **Stat tile numbers are `font-rajdhani font-bold` (matching
  `dev/metrics-board`'s own `StatTile`), not `font-anton`** — Anton stays
  reserved for `RepCounter.jsx`/`RestTimer.jsx`'s live scoreboard numbers
  only, so a "big Anton number" always means something happening *right
  now*, never a static summary value.

- **Snapshot, not live state.** `WorkoutSession.jsx`'s `handleEndSession`
  calls `buildWorkoutSummary()` (`lib/workoutSummary.js`) *before* calling
  `useExerciseTracker`'s `reset()` — `reset()` clears `completedSets` and
  `totalRestMs`, so this is the only point that data is still readable.
  `buildWorkoutSummary` bundles `completedSets`, `totalDurationMs` (wall
  clock since a `sessionStartedAtRef` captured at mount — separate from the
  tracker, since a workout's total duration outlives any one rest/active
  phase), `totalRestMs`, average heart rate (mean of every `heart_rate_bpm`
  reading in `vitals`), and `summaryScoresFor(completedSets)` — a whole-
  session muscle heatmap built the same way the live one is (same
  `LOAD_PER_REP` weight table in `lib/muscleMap.js`) but summed once from
  the final set list instead of decaying frame-by-frame.
- **Front + back heatmap.** `@musclemap/react`'s `view` prop is `"FRONT"` or
  `"BACK"` only (no `"BOTH"`), so the summary renders two `MuscleHeatmap.jsx`
  tiles side by side with `view="FRONT"` and `view="BACK"` — `MuscleHeatmap`
  now takes `view` as a prop (default `"FRONT"`, unchanged for its usual
  spot in the live HUD) rather than hardcoding it. A light-to-heavy-load
  gradient swatch underneath (reusing the exported `HEATMAP_RED` scale)
  stands in for a legend, since the color model here is a continuous 0-100
  score, not discrete primary/secondary/untargeted categories.
- **Heart rate zone** reuses the same 5-zone model as the live
  `HeartRateGauge.jsx` dial, now factored out into `lib/heartRateZones.js`
  (`HEART_RATE_ZONES`, `zoneForBpm`) so both places share one definition.
- **Exercise table** groups the flat `completedSets` log by exercise name
  into SETS/total-REPS rows (`groupSets()` in `WorkoutSummary.jsx`), styled
  as a name-left/numbers-right list — the format asked for was a workout-
  plan-style table, not a per-set chronological log like the old
  `SetHistory.jsx` did.
- **Persistence stub.** `stubSaveWorkoutSummary()` in `lib/workoutSummary.js`
  just logs the snapshot and resolves `{ saved: false }` — a real call site
  for whenever a `POST /api/workouts/:id/summary`-style endpoint exists,
  intentionally not built yet (no schema/architecture decisions made here).
- **"New Workout"** clears the summary and resets `sessionStartedAtRef`
  without leaving `/session` (stays in the immersive view); **"Home"**
  navigates back to `/` via the existing back-button route.

## Design: "Liquid Glass"

The UI follows a frosted-glass look: `bg-white/10 backdrop-blur-xl border
border-white/20` cards over a `from-indigo-950 via-violet-900
to-fuchsia-900` gradient background, white text, rounded-full nav/buttons.
`GlassTile.jsx` is the one shared surface every *immersive-HUD* element
sits in — **each metric, control, and readout gets its own tile** rather
than several elements sharing one big card (compose it with layout classes
via `className`; don't reinvent the border/blur/shadow combo elsewhere).

**The non-immersive pages use the richer `.liquid-glass` utility class
instead** (`styles/index.css`, ported from the `dev/metrics-board` branch —
see "Workout Saved summary" above for the fuller writeup of where it came
from): a diagonal sheen instead of a flat fill, saturated blur, and an
inner highlight so a tile reads as a curved, light-catching slab. Right
now that's `Dashboard.jsx`'s main card and everything in
`WorkoutSummary.jsx`; `GlassTile.jsx` usage elsewhere (the immersive HUD,
`History.jsx`, the top nav in `App.jsx`) is untouched — this was a
deliberate, scoped port, not a full replacement of one style with the
other.

Two type families, applied consistently: **Anton** for the one thing that
should read as a giant scoreboard number — the rep count in
`RepCounter.jsx` (`font-anton`) — and **Rajdhani** for everything else,
**bold (700)** for titles/headings and **light (300)** for
subtitles/secondary text. Both are loaded via Google Fonts in `index.html`
and registered in `tailwind.config.js`'s `fontFamily` (`font-anton`,
`font-rajdhani` — pair the latter with `font-bold` or `font-light`).
Changing `tailwind.config.js`'s `theme.extend` sometimes needs a dev-server
restart to take effect, not just a hot reload — if a new utility class
silently does nothing, restart before assuming the class name is wrong.

### Workout session layout: an immersive HUD, not side panels

`WorkoutSession.jsx` makes the camera feed fill the entire screen —
`CameraFeed.jsx` is `absolute inset-0`, not a framed box — with small,
independently-positioned glass tiles floating over it as a heads-up
display, rather than full-width side panels:

- **No back button.** An earlier version had one, top-left — removed since
  ending the workout (see below) is the one action this screen needs to
  offer; the browser's own back navigation still works as an escape hatch.
- **Top-middle, but only while resting:** `RestTimer.jsx` — the rest
  stopwatch, shown in place of nothing (there's no permanent element here)
  whenever `phase === 'resting'` and `restElapsedMs > 0`. Same `font-anton`
  family as `RepCounter.jsx`'s rep count, one size down (`text-5xl` vs
  `text-6xl`) so the two read as the same "big number" language without
  competing for weight — they're never both on screen at once anyway,
  since a set is either active (showing reps) or resting (showing this).
- **Upper-left, below that:** `MetricsSidebar.jsx` — a narrow (`w-36`)
  vertical stack of individually-tiled metrics: `HeartRateGauge.jsx` and
  breathing. Each is its own `GlassTile`, not sections sharing one card.
  Speed/peak-acceleration tiles used to live here too — removed as HUD
  noise (see the tracking section above for where that data still lives).
- **Far right edge, vertically centered:** a narrow vertical column, top to
  bottom — `ExerciseTitle.jsx` (current exercise name), `MuscleHeatmap.jsx`
  (front view only — `view="FRONT"`, not `"BACK"`, to stay compact at this
  width), `RepCounter.jsx` (the big Anton number, rep count only — no
  phase-awareness; see `RestTimer.jsx` above for that), then a rep-goal
  `GaugeRing.jsx` — four separate tiles stacked with `gap-3`, not one shared
  card. Rep goal lives here rather than in the left HUD because it's part of
  "what am I doing and how's it going," which reads better next to the
  exercise name than next to heart rate/breathing. Session-level stats
  (sets, total/rest time, avg HR) are deliberately **not** in this column —
  see "Workout Saved summary" above for where they live instead.

**Heart rate gets its own dedicated dial, not the generic `GaugeRing.jsx`.**
`HeartRateGauge.jsx` is a Garmin-watch-style widget: a 270° arc split into
5 zone-colored segments (`ZONES`, resting -> max, blue -> red, based on %
of `ASSUMED_MAX_HR`), a tick marking the current reading's position on that
arc, the zone name and raw bpm in the center, and a heart icon tinted to
the current zone. It's structurally different from `GaugeRing.jsx` (an arc
of discrete colored segments vs. one continuous single-color progress
ring), which is why it's a separate component rather than a prop variant —
forcing both shapes through one component would make either one harder to
read. `GaugeRing.jsx` is still what everything else uses (rep goal here).
- **Bottom-middle:** the Auth0 setup notice (if `!configured`) stacked
  directly above `SessionControls.jsx` — now a single End Workout control
  (Reset and Pause/Resume were dropped; ending the workout is the only
  thing this screen lets you do to it), icon-only at rest with its label
  hidden (`max-w-0 opacity-0`) rather than a `title`/`aria-label`-only
  affordance. Hovering or focusing it grows the label in
  (`group-hover:max-w-[10rem] group-hover:opacity-100`, `overflow-hidden`
  clipping the growing text so it slides rather than snaps) instead of
  showing it permanently — the pill stays visually quiet until the user's
  actually reaching for it. The notice is *first* in that flex column and
  the control is *last*, so it stays pinned to the same `bottom-6` position
  whether or not the notice above it is showing, rather than shifting
  position based on it.

**The left column caps its height and scrolls internally**
(`max-h-[62vh] overflow-y-auto`) rather than assuming its content always
fits — its 4 tiles are a fixed set today, but centering alone doesn't know
to leave room for the bottom-middle controls/notice on a short viewport, so
the cap is kept as a safety net. The right column dropped this same
treatment once `SetHistory.jsx` was removed from it (4 tiles now fit
comfortably within a normal viewport without it — the internal scrollbar
that treatment produced was the actual complaint that led to moving session
stats into `WorkoutSummary.jsx` instead of just tolerating it). If you add
another tile to either column, re-check on a short/mobile viewport rather
than assuming the existing budget still has room — re-add the cap to the
right column too if it's ever needed again.

Because every element here is a small, fixed-width tile rather than a
width-dependent column (the old design's `sm:w-1/4` side panels), **the
same absolute-positioned markup works from phone to desktop with no
separate mobile breakpoint** — unlike the previous full-width-panel layout,
which needed a distinct stacked-flow structure below `sm`. Verify this
holds if a tile's content ever grows (e.g. a longer exercise name) rather
than assuming it forever.

**The top nav bar is hidden entirely on `/session`** (see `App.jsx`'s
`immersive = location.pathname === '/session'` check) for a full-screen,
distraction-free view — nothing here has a header around it, and (since the
back button was removed) nothing at the top at all unless a set is resting.
Any absolutely-positioned banner on this page (the "Auth0 isn't configured"
notice) has to be checked against `SessionControls` — it covered the
controls once before the notice moved above them in the same bottom-anchored
flex column (see above); the fix was vertical separation (moving the
controls to their own end of that column), not z-index, since z-index alone
would still block clicks on whichever element loses.

`App.jsx`'s shell is a fixed-height flex column (`h-screen flex flex-col
overflow-hidden`, with `<main>` as `flex-1 overflow-y-auto`) rather than a
naturally-flowing page, so `WorkoutSession.jsx` has a real `h-full` to
anchor its `absolute` children against. `Dashboard.jsx` and `History.jsx`
are unaffected — short, centered content that fits fine inside that same
scrollable `<main>` — and both keep the top nav bar since `immersive` is
only true on `/session`.

**History moved to the home screen.** `WorkoutSession.jsx` doesn't link to
it at all (there's no header to hold that link, and burying a navigation
link inside the immersive session view didn't make sense); `Dashboard.jsx`
has a "View history" link under the primary "Start a workout" button.

**Heatmap color:** `MuscleHeatmap.jsx` uses `@musclemap/react`'s
`monochromeColor`/`monochromeBaseColor` props (a 2-point grey→color scale,
not the multi-hue `LOAD` ramp) set to the brand red scale — `#FADCDC`
(lightest, score 0) through `#DF2629` (deepest, score 100). The library
only takes two endpoints and interpolates, so the given 200/300/400
mid-tones aren't fed in as literal stops; they're documented in
`HEATMAP_RED` in that file for reference and land close to the
interpolated result anyway since they're already a roughly linear
progression between the two endpoints.

**Body base colors (off-white/surface-white, not the library's default dark
navy/grey) are CSS overrides, not props.** `monochromeBaseColor` only
recolors muscles that are actually scored — present in `values` — so it
has no effect on the rest of the figure. `@musclemap/react` bakes two
*different*, unrelated neutral colors into the SVG that aren't exposed
through any prop:

1. The outer body/skin silhouette — one path, filled via a gradient in the
   library's own defs (id ending in `-base`, e.g. `mm-r1-male-front-base`).
2. Every individual *unscored* muscle shape — ~28 separate paths, each a
   flat `fill="#3a465e"` (confirmed by inspecting the live SVG's `fill`
   attributes with nothing scored — don't assume from a screenshot alone
   which paths are "detail linework" vs. actual muscle shapes, as an
   earlier pass at this doc did incorrectly).

`MuscleHeatmap.jsx` overrides both with a scoped `<style>` tag: a
`stop-color` rule for (1) and a `fill` rule targeting `path[fill="#3a465e"]`
for (2). Both work with an ordinary stylesheet rule and no `!important`,
because SVG's `stop-color`/`fill` *attributes* are presentation attributes
— the lowest-specificity layer in the CSS cascade. The gradient selector
(`[id$="-base"]`) is broad on purpose to survive a sex/view change; the
muscle-fill selector is pinned to the exact hex the library currently
ships, so if a future `@musclemap/react` version changes that default, the
override silently stops matching and unscored muscles revert to the
library's dark grey — worth a quick visual check after bumping that
dependency.

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
