# Scaylr CRM

A full-stack lead-management system for sales teams. Dark-themed React frontend, Express + SQLite backend, JWT auth with role-based access, drag-and-drop pipeline, call logging, follow-ups, team targets, activity log, and AI-powered lead intelligence via Claude.

## Tech stack

- **Frontend:** React + Vite + TypeScript, Tailwind CSS, Recharts, @dnd-kit, date-fns, lucide-react
- **Backend:** Node.js + Express, JWT auth (bcrypt-hashed passwords)
- **Database:** SQLite via `better-sqlite3` — zero config, file-based, persists to `server/db/scaylr.db`
- **AI:** Anthropic `claude-sonnet-4-6` — Lead Intelligence + Call Note Assistant

## Project structure

```
scaylr-crm/
├── client/                 # React frontend (Vite)
│   └── src/
│       ├── pages/          # Dashboard, Leads, LeadDetail, Pipeline, FollowUps,
│       │                   #   TeamTargets, ActivityLog, UserMgmt, Login
│       ├── components/     # Layout, Sidebar, LeadForm, shared UI
│       ├── context/        # AuthContext, ToastContext
│       └── lib/            # api client, constants (colors, permissions)
├── server/                 # Express backend
│   ├── db/                 # schema.sql, SQLite adapter (better-sqlite3), seed
│   ├── routes/             # one file per feature (+ ai.js)
│   ├── middleware/         # JWT auth + permission matrix
│   └── index.js            # entry point (also serves the built client in prod)
├── render.yaml             # Render.com deploy blueprint
├── Dockerfile              # portable image for any container host
└── package.json            # root convenience scripts
```

## Setup

Requires Node 18+.

```bash
# Install dependencies for both client and server
npm run install:all
# (or: cd server && npm install   then   cd client && npm install)
```

Copy the env example and (optionally) add your Anthropic API key for AI features:

```bash
cp server/.env.example server/.env
# Edit server/.env and set ANTHROPIC_API_KEY
```

The app works without `ANTHROPIC_API_KEY` — the AI buttons will show an error toast, but everything else functions normally.

## Running

Open two terminals from the project root:

```bash
# Terminal 1 — backend API (http://localhost:4000)
npm run server

# Terminal 2 — frontend dev server (http://localhost:5173)
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` to the backend automatically.

On first run the backend creates `server/db/scaylr.db`, applies the schema, and seeds a default admin user plus sample data automatically.

## Default accounts

| Role     | Email               | Password     |
| -------- | ------------------- | ------------ |
| Admin    | admin@scaylr.com    | admin123     |
| Manager  | maya@scaylr.com     | manager123   |
| Employee | evan@scaylr.com     | employee123  |

## Roles & permissions

| Permission              | Admin | Manager | Employee |
|-------------------------|:-----:|:-------:|:--------:|
| View all leads          | ✓     | ✓       | ✓        |
| Edit own assigned leads | ✓     | ✓       | ✓        |
| Edit any lead           | ✓     | ✓       | ✗        |
| Delete leads            | ✓     | ✓       | ✗        |
| Log calls               | ✓     | ✓       | ✓        |
| Manage follow-ups       | ✓     | ✓       | ✓        |
| Bulk reassign leads     | ✓     | ✓       | ✗        |
| CSV bulk import         | ✓     | ✓       | ✗        |
| Set call targets        | ✓     | ✓       | ✗        |
| View team targets       | ✓     | ✓       | ✓        |
| User management         | ✓     | ✗       | ✗        |

Permissions are enforced on both the frontend (hiding actions) and the backend (rejecting unauthorized requests).

## AI features

### Lead Intelligence (Lead Detail page)
Click **"Get AI Insights"** on any lead. Claude analyses the lead's full call history and follow-up notes and returns:
- **Lead score** — Hot / Warm / Cold
- **Engagement summary**
- **Recommended next action**
- **Best time to call**

### Call Note Assistant (Log Call modal)
Write a rough call note, then click **"Improve with AI"**. Claude rewrites it into a concise, professional sales note. Accept or dismiss the suggestion before saving.

Requires `ANTHROPIC_API_KEY` set in `server/.env` (or as an environment variable in production).

## Resetting the local database

Stop the server, delete the SQLite file, then restart to re-seed:

```bash
rm server/db/scaylr.db
npm run server
```

## Deploying

The app is deploy-ready as a single web service that serves both the API and the built frontend.

### Render.com (recommended)

1. Push this repo to GitHub.
2. On [render.com](https://render.com): **New → Blueprint** → connect the repo. Render reads `render.yaml`, creates the web service with a 1 GB persistent disk mounted at `/data`, and auto-generates a `JWT_SECRET`.
3. In the Render dashboard, set `ANTHROPIC_API_KEY` as an environment variable.
4. Render builds and deploys. The admin account seeds automatically on first boot.

### Docker

```bash
docker build -t scaylr-crm .
docker run -p 4000:4000 \
  -v scaylr-data:/data \
  -e JWT_SECRET=your-secret \
  -e ANTHROPIC_API_KEY=your-key \
  scaylr-crm
```

### Production environment variables

| Var | Required | Notes |
|-----|----------|-------|
| `JWT_SECRET` | **yes** | Long random string for signing login tokens. |
| `ANTHROPIC_API_KEY` | recommended | Enables AI features. App works without it. |
| `DB_PATH` | no | Path to SQLite file. Defaults to `server/db/scaylr.db`. Set to `/data/scaylr.db` on a mounted disk. |
| `PORT` | no | Defaults to 4000. Most hosts set this automatically. |

## Build for production locally

```bash
npm run build:deploy   # installs deps + builds the React client
JWT_SECRET=change-me ANTHROPIC_API_KEY=sk-... npm start
# One server serves both the API and the built frontend
```
