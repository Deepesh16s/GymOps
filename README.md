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
- **Public landing page** — dark, marketing-style entry point at `/` (redirects straight to `/dashboard` if already signed in); sign-in itself lives at its own `/login` route
- **Username & public identity** — every account has a unique, validated `@handle`; new users choose one at registration, existing users are assigned a temporary one automatically with a one-time prompt to personalize it
- **Public profiles** — a deliberately scoped public page (`/u/:username`) showing name, avatar, and follower/following counts; private account data and Health Connect data are never exposed through it
- **User search** — find people by username
- **Follow / unfollow** — one-directional social graph with follower/following counts
- **Block / unblock** — removes any existing follow relationship and prevents new ones while a block is active

## Tech stack

**Frontend** — React 19, Vite, React Router 7, Axios, Recharts, `@react-oauth/google`, `lucide-react`, `react-select`. Plain CSS (design tokens + shared auth/motion styles in `client/src/styles/`), no CSS framework, no animation library — page-entrance/scroll-reveal motion is a small native implementation (`client/src/components/Reveal.jsx`).

**Backend** — Node.js, Express 5, Mongoose 9 (MongoDB), JWT auth (`jsonwebtoken`), `bcryptjs`, `google-auth-library` (Google ID token verification), `helmet`, `cors`, `express-rate-limit`, `compression`, `resend` (password reset email, sent over HTTPS — Render blocks outbound SMTP, so a transactional email API is used instead of raw SMTP), `web-push` (browser push).

## Project structure

```
Repvyn/
├── client/                    React + Vite SPA
│   ├── public/                 Static assets, favicon, push service worker
│   └── src/
│       ├── pages/               Route-level views (Landing, Login, Dashboard, Goals, Calendar, ...)
│       ├── components/          Shared UI components (+ progression/, workoutHistory/ subfolders)
│       ├── styles/                Design tokens, shared auth-page shell, motion system
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
cd Repvyn

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
| `RESEND_API_KEY` | Yes (for password reset) | API key from [Resend](https://resend.com) used to send password-reset emails |
| `RESEND_FROM_EMAIL` | No | Sender address; must be on a domain verified in Resend, otherwise defaults to `onboarding@resend.dev` |
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

**Status:** email/password auth, forgot/reset password, and every other page listed under Known Limitations below — including the current dark-themed Landing/Login/Register redesign — have been verified live in a real browser across desktop and mobile viewports, in both light and dark theme. Google Sign-In's server-side token verification is correct by code review and the button renders/behaves correctly in the UI, but the actual consent-screen round trip is still blocked in this environment — it requires the deployed origin to be registered in Google Cloud Console's Authorized JavaScript origins, which can only be done once a real production URL exists.

### Social foundation

Every account has a unique, mutable `username`. `User._id` remains the permanent identity — `Follow` and `Block` (and everything built on top of them later) reference the ID, never the username, so changing a username never breaks an existing relationship.

- **Existing users** are assigned a temporary username automatically (derived from their email, with collision suffixes) the next time they log in, and see a one-time prompt — "Choose username" or "Maybe later" — that never reappears once either is chosen.
- **New users** pick a username during registration; availability is checked server-side (a live client-side check is UX only, not the source of truth).
- **Public profiles** (`/u/:username`) expose only `username`, `name`, `picture`, join date, and follower/following counts — never email, auth data, or Health Connect/health data.
- **Follow/unfollow** is one-directional (not a request/accept system). **Block** removes any existing follow relationship in both directions and prevents new ones while active; unblocking does not restore a prior follow.
- Deleting an account removes that user's `Follow` and `Block` records.

Health Connect data (steps, heart rate, HRV, sleep, etc.) is architecturally private — nothing in the social layer can expose it; a future opt-in health-sharing feature would be a separate, explicit addition, not something the current social graph does implicitly. This identity/social architecture (public/private data separation, `_id`-based relationships, per-account deletion cleanup) is being built with eventual Google Play / Health Connect compliance in mind — Play Store submission itself is not underway.

Not yet built: chat, activity feed, challenges, leaderboards, social notifications, shared achievements, and full moderation (block is the only foundation in place so far).

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

Live architecture: **Vercel** (client) + **Render** (API) + **MongoDB Atlas** (database). Config for this is checked into the repo:

- `client/vercel.json` — SPA rewrite rule (`/* -> /index.html`), required for React Router deep links/refresh to work on Vercel. Set the Vercel project's **Root Directory** to `client` when connecting the repo.
- `render.yaml` — Render Blueprint for the API service (`rootDir: server`, `npm install` / `npm start`). Every secret is declared with `sync: false`, meaning Render will prompt for the value rather than storing it in the repo — nothing here has a real value baked in.

Steps:

- **API (Render)** — connect the repo, Render reads `render.yaml` and creates the `repvyn-api` web service. Fill in the prompted env vars (`MONGO_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `CLIENT_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and the `VAPID_*` vars if using push). `NODE_ENV=production` is already set by the blueprint.
- **Client (Vercel)** — connect the repo with Root Directory `client`; Vercel auto-detects the Vite build. Set `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, and (optionally) `VITE_VAPID_PUBLIC_KEY` as build-time env vars (Vite inlines them into the build — they cannot be changed at runtime after building).
- **CORS** — once both are deployed, set `CLIENT_URL` on Render to the exact Vercel URL, or every API request will be rejected in production.
- **Google OAuth** — add the deployed Vercel URL to the OAuth client's Authorized JavaScript origins in Google Cloud Console. This can only be done once the real Vercel URL exists, so it's expected to happen right after the first deploy, not before.
- **MongoDB Atlas** — allow-list Render's outbound IP(s) (or use Atlas's "allow from anywhere" with a strong `MONGO_URI` password), and use the Atlas connection string, not a local `mongod` URI.

Other hosts remain possible (any Node host for the API, any static host for the client) — the env vars and CORS/OAuth requirements above apply regardless; only the two files above are Vercel/Render-specific.

## Known limitations

- No automated test suite (unit, integration, or e2e) exists for either the client or the server.
- No CI pipeline — lint/build/tests do not run automatically on push or PR.
- Landing, Login, Register, Forgot/Reset Password, Dashboard, Analytics, Progression, Goals, Calendar, Workout History, Profile, and Notifications have all been exercised live in a real browser (Playwright), including mobile viewports (down to 320px) and both light/dark theme — this is no longer unverified.
- Still not verified in a real browser: the full Google OAuth consent-screen round trip (needs a real Google account; blocked in this environment by origin configuration, not a code issue), screen-reader/assistive-technology behavior, and testing in browsers other than Chromium.
- `DELETE /api/auth/account` removes only the `User` document — workouts, goals, exercises, and notifications are not cascade-deleted and become orphaned. Not fixed since it's a data-retention/product decision, not a clear bug.
- `server/scripts/` contains five one-off data migration scripts that have already been applied to the live data they targeted; they are kept for historical reference, not as reusable maintenance tools.
