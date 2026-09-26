# Role division (4 people)

These roles split along the natural seams in the architecture (see
[ARCHITECTURE.md](ARCHITECTURE.md)). Two roles (#2 and #3) both touch the
camera pipeline, so they should pair up early on `useCamera.js` — that's the
one file both of them depend on.

## 1. Backend & Data — API + Auth0 + TigerData

**Owns:** `backend/app/__init__.py`, `config.py`, `extensions.py`,
`auth/`, `models/`, `routes/workouts.py`, `sql/create_hypertable.sql`.

- Stand up the Flask app factory, blueprints, and Auth0 JWT verification
  (`@requires_auth`).
- Design/extend the SQLAlchemy models as features need them (e.g. a
  paginated session list for the History page).
- Provision the TigerData service (or local `docker-compose up` for dev),
  run migrations, apply `create_hypertable.sql`.
- Own deployment (wherever the team decides to host: Render/Fly/Railway
  are all fine for a hackathon).

## 2. Computer Vision — pose tracking & rep counting

**Owns:** `frontend/src/hooks/usePoseDetection.js`,
`backend/app/pose_engine/` (`rep_counter.py`, `pose_estimator.py`,
`muscle_map.py`), the rep-counting logic wired into
`frontend/src/pages/WorkoutSession.jsx`.

- Get MediaPipe's PoseLandmarker running against the shared video stream
  and turn landmarks into joint angles.
- Build the actual rep-counting state machine (the Python
  `RepCounter`/`angle_between` in `pose_engine/rep_counter.py` is a
  reference implementation — port the same logic to JS for the client-side
  path, since that's what runs in real time).
- Extend `muscle_map.py` with more exercises as the demo needs them.
- Decide, with role #1, whether any pose data needs to be persisted
  server-side (e.g. for a "form score" over time).

## 3. Vitals Integration — Presage + camera pipeline plumbing

**Owns:** `frontend/src/hooks/useCamera.js`, `useVitalsUpload.js`,
`backend/app/services/presage_client.py`, `backend/app/routes/vitals.py`.

- **First task:** get a real Presage API key and confirm the actual
  request/response shape against `https://docs.physiology.presagetech.com/`
  — `presage_client.py`'s field names (`upload_url`, `pulse_rate`, etc.)
  are a best guess and will likely need small fixes.
- Own the shared `MediaStream` (`useCamera.js`) since both this role and
  role #2 depend on it — don't let either side quietly fork it into two
  separate `getUserMedia()` calls.
- Tune chunk size/interval in `useVitalsUpload.js` for latency vs. API
  usage.
- Surface upload/poll failures usefully in the UI instead of silently
  dropping them (currently just `console.error`).

## 4. Frontend / UX

**Owns:** `frontend/src/App.jsx`, `pages/`, `components/`,
`tailwind.config.js`, responsive layout for desktop + phone.

- Turn the placeholder pages (`Dashboard.jsx`, `History.jsx`,
  `WorkoutSession.jsx`) into the real demo flow.
- Extend `MetricsSidebar.jsx` / `RepCounter.jsx` / `MuscleHeatmap.jsx` with
  real data from roles #2 and #3 as it becomes available (they take props,
  so this should be additive) — keep new UI in the same "liquid glass" card
  style (`rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl`,
  see docs/ARCHITECTURE.md's Design section).
- Test on an actual phone early — camera permissions, layout at narrow
  widths, and touch targets are easy to get wrong late.
- Own visual polish: loading states, empty states, error states (e.g. "no
  person detected", "camera permission denied").

## Suggested phases

1. **Setup (everyone, in parallel):** clone repo, get `docs/SETUP.md`'s
   local dev environment running end-to-end (health check responds, blank
   frontend loads). Get Auth0/Presage/TigerData accounts created early —
   they're the most likely source of "waiting on an email" delays.
2. **Core loop:** #2 gets landmarks flowing into a rep count in the
   browser; #3 gets one video chunk successfully round-tripped through
   Presage; #1 has session/set endpoints working; #4 has the session page
   laid out with placeholder data.
3. **Integration:** wire real pose + vitals data into the UI; persist sets
   and readings through role #1's endpoints.
4. **Polish:** error/empty states, mobile pass, seed a couple of demo
   sessions for History, rehearse the demo script.
