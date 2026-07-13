# Deploying edu-timetabelo (free stack)

Target: **Frontend on Vercel · Backend on Render · Database on Neon (Postgres)**.
All three have free tiers. Total cost: $0.

> Heads-up: Render's free backend **sleeps after ~15 min idle**. The first
> request after a nap takes ~30s to wake up, then it's fast again.

---

## 0. Push the code to GitHub

Vercel and Render deploy from a Git repo, so the code needs to be on GitHub.

```bash
cd ~/edu-timetabelo
git add .
git commit -m "Deploy: Postgres support, invite gate, Vercel/Render config"
# Create an empty repo on github.com first, then:
git branch -M main
git remote add origin https://github.com/<your-username>/edu-timetabelo.git
git push -u origin main
```

---

## 1. Database — Neon (Postgres)

1. Go to https://neon.tech and sign up (free).
2. Create a project (any name, nearest region).
3. Open **Connection Details** and copy the **connection string**. It looks like:
   ```
   postgresql://user:password@ep-xxxx.region.aws.neon.tech/dbname?sslmode=require
   ```
4. Keep this handy — it's your `DATABASE_URL`.

The backend auto-creates its tables on first boot, so there's nothing else to do here.

---

## 2. Backend — Render

Easiest path uses the included `render.yaml` blueprint.

1. Go to https://render.com and sign up with GitHub.
2. **New +  ->  Blueprint**, pick your `edu-timetabelo` repo. Render reads `render.yaml`.
3. When prompted, fill the environment variables:
   - `DATABASE_URL` = the Neon string from step 1
   - `INVITE_CODE`  = a secret word you and your friend will use to sign up
     (e.g. `letmein-2026`). This blocks strangers from registering.
   - `SECRET_KEY` is auto-generated. `CORS_ORIGINS` is already `*`.
4. Click **Apply** / **Create**. First build takes a few minutes.
5. When live, copy the service URL, e.g.:
   ```
   https://edu-timetabelo-backend.onrender.com
   ```
6. Sanity check: open `<that-url>/api/health` — you should see `{"status":"ok"}`.

(No blueprint? Do it manually: New + -> Web Service -> your repo -> Runtime
**Docker**, Dockerfile path `./backend/Dockerfile`, root/context `./backend`,
plan **Free**, then add the same env vars.)

---

## 3. Frontend — Vercel

1. Go to https://vercel.com and sign up with GitHub.
2. **Add New -> Project**, import the `edu-timetabelo` repo.
3. Set **Root Directory** to `frontend`. (Vercel auto-detects Vite; `vercel.json`
   already sets build command and output dir.)
4. Add an **Environment Variable**:
   - `VITE_API_BASE` = your Render backend URL from step 2
     (e.g. `https://edu-timetabelo-backend.onrender.com`, no trailing slash)
5. **Deploy**. You'll get a public URL like `https://edu-timetabelo.vercel.app`.

> If you set `VITE_API_BASE` after the first deploy, trigger a redeploy so the
> new value is baked into the build (Vite env vars are read at build time).

---

## 4. Use it

1. Open the Vercel URL.
2. You and your friend each **Sign up** — enter the shared **invite code** from
   step 2, plus a display name.
3. You're in the same shared workspace: create tasks, assign them to each other,
   run weekly/monthly sprints, and track progress. Data lives in Neon, so it
   persists.

---

## Updating later

Push to `main` and both Vercel and Render redeploy automatically:

```bash
git add .
git commit -m "your change"
git push
```

---

## Local development is unchanged

Locally you still use Docker Compose with SQLite and open registration
(no invite code needed):

```bash
SECRET_KEY=dev-secret-change-me docker compose up --build
```
