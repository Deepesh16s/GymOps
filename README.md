# Repvyn

A full-stack fitness tracking application: workout logging, live workout sessions, a workout planner, cardio tracking, goals, and a deterministic (non-AI) training intelligence layer that surfaces recovery, fatigue, plateau, and training-balance insights from a user's own logged data.

There is no LLM/AI API integration. Every "intelligence" or "coach" feature is a rule-based calculation over the user's workout history, computed client-side.

## Features

- **Workout tracking** — strength sets (weight/reps) and cardio entries, grouped into sessions
- **Live workout sessions** — start/finish a session with a running timer, rest timer, and set-by-set logging
- **Workout History** — session timeline with filtering, editing, and timing corrections
- **Progression** — per-exercise and per-muscle trend charts, personal records, training heatmap
- **Analytics** — muscle group distribution, volume trends
- **Goals** — Strength PR, weekly/monthly volume or session-count, session-level, streak, cardio, and weight goals, with automatic progress recalculation
- **Calendar** — day-level view of logged and planned workouts
- **Planned Workout / Planner** — schedule workouts (including recurring series), reschedule, duplicate, cancel, or convert into a real session
- **Cardio ecosystem** — activity-specific cardio entries and cardio-specific goal metrics
- **Notifications & Reminder Engine** — in-app notification center plus a client-side reminder engine (workout/goal/recovery/streak/neglect/planner/achievement reminders) that generates candidates the server dedupes and persists
- **Browser push notifications** — optional Web Push delivery for a subset of notification types, via a dedicated service worker
- **Training intelligence** — recovery scores, readiness, fatigue level, plateau detection, deload recommendations, training balance (upper/lower, strength/cardio splits), volume landmarks, muscle priority, weekly grade, and a deterministic "coach priority" summary — all derived from the user's own logged workouts, no external API calls
- **Google Sign-In** — alongside email/password auth with forgot/reset password via email

## Tech stack

**Frontend** — React 19, Vite, React Router 7, Axios, Recharts, `@react-oauth/google`, `lucide-react`, `react-select`. Plain CSS (design tokens in `client/src/styles/design-tokens.css`), no CSS framework.

**Backend** — Node.js, Express 5, Mongoose 9 (MongoDB), JWT auth (`jsonwebtoken`), `bcryptjs`, `google-auth-library` (Google ID token verification), `helmet`, `cors`, `express-rate-limit`, `compression`, `nodemailer` (password reset email), `web-push` (browser push).

## Project structure

```
GymOps/
├── client/                    React + Vite SPA
│   ├── public/                 Static assets, favicon, push service worker
│   └── src/
│       ├── pages/               Route-level views (Dashboard, Goals, Calendar, ...)
│       ├── components/          Shared UI components (+ progression/, workoutHistory/ subfolders)
│       ├── services/             Axios wrappers per resource (api.js holds the shared instance)
│       ├── hooks/                 Reusable hooks (workout session state, push notifications, ...)
│       ├── context/                ThemeContext (dark mode)
│       ├── constants/               Shared enums (goal types, muscle groups, session types, ...)
│       ├── utils/                    Pure helper functions (dates, formatting, scoring)
│       ├── intelligence/              Training intelligence engines (recovery, fatigue, plateau, ...)
│       ├── progression/               Progression metrics/filters/insights engines
│       ├── trainingIntelligence/      Orchestration layer composing intelligence/ + progression/ for each UI surface
│       └── reminders/                 Client-side reminder engine (candidate generation, prioritization, grouping)
└── server/                    Express API
    ├── config/db.js            Mongoose connection
    ├── routes/                  One file per resource, mounted under /api/*
    ├── controllers/               Request handlers
    ├── middleware/                 protect (JWT), validateObjectId, auth rate limiters
    ├── models/                      Mongoose schemas
    ├── utils/                        Business logic shared across controllers (goal recalculation, notification service, planned-workout recurrence, push delivery)
    ├── constants/                     Shared enums (mirrors client/src/constants where the same concept exists on both sides)
    ├── data/defaultExercises.js        Seeded on registration
    └── scripts/                        One-off, already-applied data migrations (kept for history — see docs/ARCHITECTURE.md)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for data flow and [docs/API.md](docs/API.md) for the full endpoint reference.

## Local setup

Requires Node.js and a MongoDB instance (local or [Atlas](https://www.mongodb.com/atlas)).

```bash
git clone <this repo>
cd GymOps

# Server
cd server
npm install
cp .env.example .env   # fill in real values, see below
npm run dev             # nodemon, http://localhost:5000

# Client (separate terminal)
cd client
npm install
cp .env.example .env   # fill in real values, see below
npm run dev              # Vite, http://localhost:5173
```

### Environment variables

Full templates: [`server/.env.example`](server/.env.example), [`client/.env.example`](client/.env.example). Never commit a real `.env` — both are already git-ignored.

**Server**

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Signs/verifies login tokens |
| `GOOGLE_CLIENT_ID` | Yes (for Google Sign-In) | Audience for verifying Google ID tokens |
| `CLIENT_URL` | Yes in production | Locks CORS to this origin; also used to build the password-reset email link |
| `EMAIL_USER` / `EMAIL_PASS` | Yes (for password reset) | Gmail account + [App Password](https://myaccount.google.com/apppasswords) used by Nodemailer |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_CONTACT_EMAIL` | No | Web Push; push delivery is silently disabled if unset |
| `PORT` | No (default 5000) | API port |
| `NODE_ENV` | No | `production` enables strict CORS and disables the dev request logger |
| `AUTH_RATE_LIMIT_*`, `AUTH_FORGOT_PASSWORD_RATE_LIMIT_*` | No | Override the default auth rate limits |

**Client**

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | No (default `http://localhost:5000/api`) | Base API URL |
| `VITE_GOOGLE_CLIENT_ID` | Yes (for Google Sign-In) | Must match the server's `GOOGLE_CLIENT_ID` |
| `VITE_VAPID_PUBLIC_KEY` | No | Must match the server's `VAPID_PUBLIC_KEY`; push opt-in is hidden if unset |

### MongoDB setup

Any reachable MongoDB deployment works — a local `mongod`, or an Atlas free-tier cluster. No seed data or indexes are required beyond what Mongoose creates from the schemas (e.g. the unique index on `User.email`). Registering a new user automatically seeds that user's default exercise list from `server/data/defaultExercises.js`.

### Authentication

Two independent sign-in paths, both issuing the same JWT (`Authorization: Bearer <token>`, 7-day expiry, stored client-side in `localStorage`):

- **Email/password** — bcrypt-hashed (`POST /api/auth/register`, `/login`), plus forgot/reset password via a time-limited emailed token.
- **Google Sign-In** — the client obtains an ID token via `@react-oauth/google`; the server verifies it with `google-auth-library` (`POST /api/auth/google`) and creates the user on first sign-in.

**Status:** the server-side Google token verification was recently fixed and is believed correct from code review, but a full browser OAuth round trip (consent screen → token → account creation/login) has **not** been verified in this pass — no browser tooling was available in this session. Treat it as needing a manual check before relying on it in production. See [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).

## Development commands

| Command | Where | Does |
|---|---|---|
| `npm run dev` | `server/` | Starts the API with nodemon (auto-restart) |
| `npm start` | `server/` | Starts the API with plain `node` (production-style) |
| `npm run dev` | `client/` | Starts the Vite dev server |
| `npm run build` | `client/` | Production build to `client/dist/` |
| `npm run preview` | `client/` | Serves the production build locally |
| `npm run lint` | `client/` | ESLint over `client/src` |

## Production build

```bash
cd client && npm run build   # outputs static assets to client/dist/
```

Serve `client/dist/` from any static host (see below); run `server/` as a long-lived Node process with `NODE_ENV=production` and a real `CLIENT_URL` set (production CORS rejects any other origin).

## Deployment considerations

Target architecture: **Vercel** (client) + **Render** (API) + **MongoDB Atlas** (database). Config for this is checked into the repo:

- `client/vercel.json` — SPA rewrite rule (`/* -> /index.html`), required for React Router deep links/refresh to work on Vercel. Set the Vercel project's **Root Directory** to `client` when connecting the repo.
- `render.yaml` — Render Blueprint for the API service (`rootDir: server`, `npm install` / `npm start`). Every secret is declared with `sync: false`, meaning Render will prompt for the value rather than storing it in the repo — nothing here has a real value baked in.

Steps:

- **API (Render)** — connect the repo, Render reads `render.yaml` and creates the `repvyn-api` web service. Fill in the prompted env vars (`MONGO_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `CLIENT_URL`, `EMAIL_USER`, `EMAIL_PASS`, and the `VAPID_*` vars if using push). `NODE_ENV=production` is already set by the blueprint.
- **Client (Vercel)** — connect the repo with Root Directory `client`; Vercel auto-detects the Vite build. Set `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, and (optionally) `VITE_VAPID_PUBLIC_KEY` as build-time env vars (Vite inlines them into the build — they cannot be changed at runtime after building).
- **CORS** — once both are deployed, set `CLIENT_URL` on Render to the exact Vercel URL, or every API request will be rejected in production.
- **Google OAuth** — add the deployed Vercel URL to the OAuth client's Authorized JavaScript origins in Google Cloud Console. This can only be done once the real Vercel URL exists, so it's expected to happen right after the first deploy, not before.
- **MongoDB Atlas** — allow-list Render's outbound IP(s) (or use Atlas's "allow from anywhere" with a strong `MONGO_URI` password), and use the Atlas connection string, not a local `mongod` URI.

Other hosts remain possible (any Node host for the API, any static host for the client) — the env vars and CORS/OAuth requirements above apply regardless; only the two files above are Vercel/Render-specific.

## Known limitations

- No automated test suite (unit, integration, or e2e) exists for either the client or the server.
- No CI pipeline — lint/build/tests do not run automatically on push or PR.
- Full Google OAuth browser flow, modal focus-trap behavior, screen-reader accessibility, and mobile/responsive rendering have not been verified in a real browser as part of this audit (no browser tooling was available). See [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) for the complete verified/unverified breakdown.
- `server/scripts/` contains four one-off data migration scripts that have already been applied to the live data they targeted; they are kept for historical reference, not as reusable maintenance tools.
