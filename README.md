# Scaylr CRM

A full-stack lead-management system for sales teams. Dark-themed React frontend, Express + Postgres backend, JWT auth with role-based access, a drag-and-drop pipeline, call logging, follow-ups, team targets, and an activity log.

## Tech stack

- **Frontend:** React + Vite + TypeScript, Tailwind CSS, Recharts, @dnd-kit, date-fns, lucide-react
- **Backend:** Node.js + Express, JWT auth (bcrypt-hashed passwords)
- **Database:** PostgreSQL. In production it connects to a managed Postgres via `DATABASE_URL` (e.g. a free [Neon](https://neon.tech) database). For **local dev it uses embedded [PGlite](https://pglite.dev)** — an in-process Postgres that needs no install, persisted to `server/db/pgdata/`. Same SQL dialect in both, so dev matches prod.

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
│   ├── db/                 # schema.sql, Postgres/PGlite adapter, seed
│   ├── routes/             # one file per feature
│   ├── middleware/         # JWT auth + permission matrix
│   └── index.js            # entry point (also serves the built client in prod)
├── render.yaml             # Render.com deploy blueprint (free tier)
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

A `server/.env` is optional — defaults work out of the box. To set a custom port or JWT secret, copy `server/.env.example` to `server/.env` and edit it.

## Running

Open two terminals from the project root:

```bash
# Terminal 1 — backend API (http://localhost:4000)
npm run server

# Terminal 2 — frontend (http://localhost:5173)
npm run dev
```

Then open **http://localhost:5173**. The Vite dev server proxies `/api` to the backend automatically.

On first run the backend creates the embedded `server/db/pgdata/` database, applies the schema, and seeds a default admin user plus sample data.

## Login

| Role     | Email               | Password     |
| -------- | ------------------- | ------------ |
| Admin    | admin@scaylr.com    | admin123     |
| Manager  | maya@scaylr.com     | manager123   |
| Employee | evan@scaylr.com     | employee123  |

## Roles & permissions

- **Admin** — full access, including user management.
- **Manager** — manage all leads, set targets, CSV import, bulk reassign; cannot manage users.
- **Employee** — view all leads, edit only their own assigned leads, log calls, manage follow-ups. No delete/bulk/targets/user-management.

Permissions are enforced on both the frontend (hiding actions) and the backend (rejecting unauthorized requests).

## Resetting the local database

Stop the server, delete the embedded DB directory, then restart to re-seed:

```bash
rm -rf server/db/pgdata
npm run server
```

## Deploying (free)

The app is deploy-ready as a single web service that serves both the API and the
built frontend. The free path uses a managed Postgres for data + a free web host.

1. **Create a free Postgres** at [neon.tech](https://neon.tech) → copy the connection
   string (looks like `postgresql://user:pass@host/db?sslmode=require`).
2. **Push this repo to GitHub.**
3. **On [render.com](https://render.com):** New → Blueprint → connect the repo.
   Render reads `render.yaml`, creates the free web service, and generates a
   `JWT_SECRET`. When prompted, paste your Neon string as **`DATABASE_URL`**.
4. Render builds and deploys to a URL like `https://scaylr-crm.onrender.com`.
   The admin account seeds automatically on first boot. Share the URL with your team.

Production env vars:

| Var | Required | Notes |
|-----|----------|-------|
| `DATABASE_URL` | **yes (prod)** | Postgres connection string. If unset, the app uses embedded PGlite (local dev only). |
| `JWT_SECRET` | **yes (prod)** | Long random string for signing login tokens. |
| `PORT` | no | Defaults to 4000; most hosts set this automatically. |

> Any container host works too — build the image from the included `Dockerfile`
> and set `DATABASE_URL` + `JWT_SECRET`.

## Build for production locally

```bash
npm run build:deploy   # installs deps + builds the client
DATABASE_URL=... JWT_SECRET=... npm start   # one server serves API + frontend
```
