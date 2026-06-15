# Scaylr CRM

A full-stack lead-management system for sales teams. Dark-themed React frontend, Express + SQLite backend, JWT auth with role-based access, a drag-and-drop pipeline, call logging, follow-ups, team targets, and an activity log.

## Tech stack

- **Frontend:** React + Vite + TypeScript, Tailwind CSS, Recharts, @dnd-kit, date-fns, lucide-react
- **Backend:** Node.js + Express, better-sqlite3 (local file DB, no setup), JWT auth (bcrypt-hashed passwords)

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
│   ├── db/                 # schema.sql, SQLite connection, seed
│   ├── routes/             # one file per feature
│   ├── middleware/         # JWT auth + permission matrix
│   └── index.js            # entry point
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

On first run the backend creates `server/db/scaylr.db`, applies the schema, and seeds a default admin user plus sample data.

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

## Resetting the database

Stop the server and delete the DB files, then restart to re-seed:

```bash
rm server/db/scaylr.db server/db/scaylr.db-shm server/db/scaylr.db-wal
npm run server
```

## Build for production

```bash
npm run build        # builds the client into client/dist
```

Serve `client/dist` with any static host and run the backend with `npm run server` (set `JWT_SECRET` in `server/.env`).
