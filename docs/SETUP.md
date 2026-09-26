# Setup

## Prerequisites

- Python 3.9+ (the boilerplate is written to run on 3.9, since that's what
  ships with macOS; anything newer works too)
- Node.js 20+
- Docker (optional, for a local TigerData/Timescale instance)
- A webcam and a browser that supports `getUserMedia` (Chrome/Edge/Safari,
  over `https://` or `localhost`)

## 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### Database

Pick one:

**A. Local Docker (fastest for dev):**
```bash
cd ..  # repo root, where docker-compose.yml lives
docker compose up -d
```
Leave `DATABASE_URL` in `backend/.env` as the default
(`postgresql://hth3:hth3dev@localhost:5432/hth3_dev`).

**B. Tiger Cloud (hosted TigerData):** create a free service at
https://console.cloud.timescale.com, copy its connection string into
`DATABASE_URL` in `backend/.env`.

Then, either way:

```bash
cd backend
source .venv/bin/activate
export FLASK_APP=run.py
flask db init        # first time only
flask db migrate -m "initial schema"
flask db upgrade
psql "$DATABASE_URL" -f sql/create_hypertable.sql
```

### Run it

```bash
python run.py
```

Visit http://localhost:5050/api/health — you should see `{"status": "ok"}`.

Whenever the backend can't reach the database (the health check or any
other request), it writes a line to `backend/logs/database.log` with the
time, the request, and the driver's error, e.g.
`2026-09-26 17:30:16,120 ERROR Database unreachable during GET /api/workouts/summary: ... timeout expired`.
Set `LOG_DIR` in `.env` to put it somewhere else.

Run tests with `pytest tests/`.

## 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Visit http://localhost:5173. Vite proxies `/api/*` to the Flask server on
port 5050 (see `vite.config.js`), so the frontend `.env`'s
`VITE_API_BASE_URL` can stay pointed at `http://localhost:5050/api` for
local dev.

Without any further config, the app runs with an "Auth0 isn't configured"
banner and login disabled — that's expected until step 3.

## 3. Auth0

1. Create a free tenant at https://auth0.com if you don't have one.
2. **Applications → Create Application → Single Page Application.**
   - Allowed Callback URLs: `http://localhost:5173`
   - Allowed Logout URLs: `http://localhost:5173`
   - Allowed Web Origins: `http://localhost:5173`
   - Copy the **Domain** and **Client ID** into `frontend/.env`
     (`VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`).
3. **Applications → APIs → Create API.**
   - Set an Identifier, e.g. `https://api.accountable.dev` (doesn't need to
     be a real URL, just a unique string) — this is the **audience**. Set
     the signing algorithm to **RS256** (the default, and what
     `backend/app/auth/decorators.py` expects).
   - Put that same value in `frontend/.env` (`VITE_AUTH0_AUDIENCE`) and
     `backend/.env` (`AUTH0_AUDIENCE`) — **copy it exactly, trailing slash
     and all.** Auth0 matches the audience as a literal string:
     `https://api.accountable.dev` and `https://api.accountable.dev/` are
     two different identifiers to it. A mismatch here doesn't fail quietly
     either — `loginWithRedirect()` still round-trips to Auth0 and back,
     landing on `/` with `?error=access_denied&error_description=Service
     not found: <audience>` in the URL, which is the tell that the
     identifier just needs to match exactly, not a broken client
     id/domain/callback URL.
   - Put the tenant Domain in `backend/.env` (`AUTH0_DOMAIN`).
4. Restart both dev servers so the new env vars are picked up.

## 4. Presage (vitals)

1. Request access / sign up at https://presagetechnologies.com/for-developers
   and get an API key for the Physiology REST API
   (`https://api.physiology.presagetech.com`).
2. Put the key in `backend/.env` (`PRESAGE_API_KEY`).
3. **Before relying on this in a demo:** read
   `https://docs.physiology.presagetech.com/` and compare it against
   `backend/app/services/presage_client.py`. That file's endpoint paths and
   response field names (`upload_url`, `upload_id`, `pulse_rate`,
   `breathing_rate`, `hrv`) are a best-effort guess from public
   documentation, not a verified contract — fix them to match whatever your
   API key actually returns.

## Troubleshooting

- **Camera permission denied / black video:** `getUserMedia` requires a
  secure context — `http://localhost` is fine, but a raw IP address or
  `http://` on another machine will silently fail. Use `https` or tunnel
  through `localhost` if testing on a phone.
- **MediaPipe pose model doesn't load:** `usePoseDetection.js` fetches its
  WASM runtime and model file from a CDN on first load — needs outbound
  network access. If venue wifi blocks large CDN downloads, download the
  `.task` model file ahead of time and serve it from `frontend/public/`
  instead, pointing `MODEL_URL` at the local path.
- **CORS errors:** make sure `CORS_ORIGINS` in `backend/.env` includes
  whatever origin the frontend is actually served from.
- **401s from the API:** check that both `frontend/.env`'s
  `VITE_AUTH0_AUDIENCE` and `backend/.env`'s `AUTH0_AUDIENCE` are the exact
  same string — a mismatch here is the most common Auth0 integration bug.
