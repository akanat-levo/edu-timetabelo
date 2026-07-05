# edu-timetabelo

A calendar-aware timetable manager. Plan tasks on real dates, group them into
weekly and monthly **sprints**, and track progress — with built-in scheduling
rules that reflect when you're actually free.

## Scheduling rules

Entries are only allowed inside these windows, decided by the day the date
falls on:

| Day type            | Allowed window |
| ------------------- | -------------- |
| Weekday (Mon–Fri)   | 19:00 – 23:00  |
| Weekend (Sat–Sun)   | 10:00 – 17:00  |

The backend enforces these rules; the frontend mirrors them for instant feedback.

## Features

- Email + password accounts (JWT auth) — each user has their own timetable
- Weekly grid view with prev / today / next navigation across any year
- Tasks tied to real calendar dates (year / month / day, weekday derived)
- Weekly and monthly **sprints** with auto-computed date ranges and progress bars
- Mark tasks done, delete, and assign them to a sprint

## Tech stack

- **Backend:** FastAPI, SQLAlchemy, SQLite, JWT (python-jose), passlib
- **Frontend:** React + Vite + TypeScript
- **Packaging:** Docker (multi-stage), docker-compose
- **Deploy:** Kubernetes (Deployments, Services, Ingress, PVC, Secret)

## Project layout

```
backend/    FastAPI app (app/), Dockerfile
frontend/   React + Vite app (src/), Dockerfile, nginx template
k8s/        Kubernetes manifests (kustomize)
docker-compose.yml
build-and-push.sh
```

## Run locally (without Docker)

Backend:

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
# API at http://localhost:8000  ·  docs at http://localhost:8000/docs
```

Frontend (separate terminal):

```bash
cd frontend
npm install
npm run dev
# App at http://localhost:5173 (proxies /api to :8000)
```

## Run locally with Docker Compose

```bash
SECRET_KEY=$(openssl rand -hex 32) docker compose up --build
# App at http://localhost:8080
```

## Deploy to Kubernetes + Docker Hub

1. Build and push public images:

   ```bash
   DOCKERHUB_USER=yourname TAG=v1 ./build-and-push.sh
   ```

2. Point the manifests at your images and set a real secret:

   ```bash
   cd k8s
   kustomize edit set image \
     DOCKERHUB_USER/edu-timetabelo-backend=yourname/edu-timetabelo-backend:v1 \
     DOCKERHUB_USER/edu-timetabelo-frontend=yourname/edu-timetabelo-frontend:v1
   # edit backend.yaml -> Secret SECRET_KEY (openssl rand -hex 32)
   # edit ingress.yaml -> your host
   ```

3. Apply:

   ```bash
   kubectl apply -k .
   ```

4. Grab the public address:

   ```bash
   kubectl -n timetabelo get ingress
   ```

   Share that link with your friend — each of you registers your own account.

## Notes

- SQLite runs as a single writer, so the backend stays at 1 replica with a
  `Recreate` strategy and a PersistentVolumeClaim. For multi-replica scale,
  swap `DATABASE_URL` to Postgres.
- CORS is open (`*`) by default since the frontend proxies `/api`. Tighten
  `CORS_ORIGINS` if you expose the API directly.
