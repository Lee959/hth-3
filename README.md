# FormCheck

A real-time workout coach: one webcam feed drives live rep counting +
muscle-group feedback (MediaPipe Pose, in-browser) and contactless vitals
(heart rate / breathing rate via Presage), backed by Flask + TigerData and
gated behind Auth0 login.

## Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Flask
- **Database:** TigerData (Postgres + TimescaleDB)
- **Auth:** Auth0
- **Body tracking:** MediaPipe Pose (client-side, real-time) + OpenCV/MediaPipe-Python (server-side, optional)
- **Vitals:** Presage Technologies (SmartSpectra / Physiology REST API)
- **Muscle group UI:** [@musclemap/react](https://github.com/Jsplice/MuscleMap) — live LOAD heatmap
- **Design:** "Liquid glass" — frosted translucent cards over a gradient background

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how it all fits together,
  including how one camera feed serves both the pose-tracking and vitals
  pipelines
- [docs/ROLES.md](docs/ROLES.md) — suggested 4-person role split
- [docs/SETUP.md](docs/SETUP.md) — environment setup (backend, frontend,
  Auth0, Presage, TigerData)
- [docs/API.md](docs/API.md) — REST endpoint reference

## Quickstart

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python run.py

# Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env
npm run dev
```

Then open http://localhost:5173. See [docs/SETUP.md](docs/SETUP.md) for
database provisioning and Auth0/Presage account setup — the app runs
without them, but login and vitals stay disabled until configured.
