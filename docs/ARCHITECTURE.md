# Architecture

## Overview

Repvyn is a conventional two-tier app: a React SPA talking to an Express/MongoDB REST API over JWT-authenticated JSON requests. There is no server-rendering, no GraphQL layer, and no external AI/LLM calls — every "intelligence" feature is a pure-function calculation over data the client already has loaded.

```
Browser (React SPA)  <-- JSON over HTTPS -->  Express API  <-->  MongoDB
        |
        +-- Service Worker (push notifications only, no offline caching)
```

## Backend

```
server/
├── server.js            App wiring: middleware order, route mounting, 404 + error handlers
├── config/db.js          Mongoose connection + connection-event logging
├── routes/*.js            One file per resource; declares method + path + middleware chain only
├── controllers/*.js        Request handling, validation, ownership checks
├── middleware/
│   ├── authMiddleware.js    protect — verifies the Bearer JWT, loads req.user
│   ├── authRateLimiters.js   Rate limiters for login/register/forgot-password
│   └── validateObjectId.js   Rejects a malformed :id param with 400 before it reaches a controller
├── models/*.js              Mongoose schemas
├── utils/*.js                Business logic shared across controllers (see below)
├── constants/*.js             Shared enums (goal types, muscle groups, notification types, ...)
├── data/defaultExercises.js    Seeded for a user on registration/first Google sign-in
└── scripts/*.js                 One-off migrations, already applied — see note at the bottom
```

**Request pipeline** (`server.js`): `helmet` (CSP intentionally disabled — this is a pure JSON API with no HTML templates to protect) → `compression` → `cors` (locked to `CLIENT_URL` in production, permissive in development) → `express.json()` → dev-only request logger → routes → 404 handler → centralized error handler (maps body-parser's malformed-JSON errors to 400, everything else to 500, and never leaks error internals to the client).

**Auth**: every route except `/api/auth/register|login|google|forgot-password|reset-password/:token` requires `protect`, which verifies the JWT and attaches `req.user` (password/reset-token fields excluded). Every controller that reads or mutates a specific document additionally checks that document's owning `user`/`createdBy` field against `req.user._id` — there is no role system, only per-resource ownership.

**Notable `utils/` modules and what they own:**
- `goalMetrics.js` — pure metric calculations (streaks, volume, session grouping) shared by the dashboard and goal controllers
- `updateGoals.js` / `recalculateGoals.js` — recompute goal progress after a workout is created/edited/deleted
- `notificationService.js` / `notificationTriggers.js` — the single dedup+persistence path every notification (server-detected or client-submitted) goes through
- `pushDeliveryManager.js` — decides which persisted notifications are also worth a browser push, and sends them via `web-push` (silently a no-op if VAPID keys aren't configured)
- `plannedWorkoutService.js` / `plannedWorkoutRecurrence.js` — recurring-series creation and scoped edits (`only`/`future`/`series`)
- `validateWorkoutPayload.js` / `validatePlannedWorkoutPayload.js` — request body validation shared across create/update handlers

**`server/scripts/`** — `backfillDefaultExercises.js`, `deduplicateExercises.js`, `migrateGoalExerciseRefs.js`, `reclassifyLegExercises.js`. These are one-time data migrations tied to specific past schema changes (default-exercise seeding, exercise de-duplication, Strength-PR goals moving from a string `exercise` field to an ObjectId reference, and the "Legs" muscle group splitting into Quads/Glutes/Calves). They are not wired into any npm script and aren't referenced by the running app — they're kept as a record of what migrations were run, not as tools you'd run again.

## Frontend

```
client/src/
├── pages/                Route-level views, one per URL in App.jsx
├── components/            Shared UI (+ progression/ and workoutHistory/ subfolders for page-specific pieces)
├── services/               One Axios wrapper per resource; api.js holds the shared instance (base URL, auth header injection, 401 -> logout redirect)
├── hooks/                    Reusable stateful logic (useWorkoutSession, usePushNotifications, ...)
├── context/ThemeContext.jsx   Dark mode
├── constants/                  Shared enums, mirrored from server/constants where the same concept exists on both sides
├── utils/                       Pure helpers (dates, formatting, scoring)
├── intelligence/                 Training intelligence engines (see below)
├── progression/                   Progression metrics/filters/insights engines
├── trainingIntelligence/           Orchestration layer — composes intelligence/ + progression/ into the exact shape each page needs
└── reminders/                      Client-side reminder engine
```

**Routing** (`App.jsx`): `react-router-dom`. Auth pages (`Login`, `Register`, `ForgotPassword`, `ResetPassword`) are eager-loaded and render outside the app shell. Every authenticated page is lazy-loaded and nested under a single `RequireAuth > Layout` route — `RequireAuth` checks for a token in `localStorage` before rendering anything (not just relying on API calls to 401).

**Intelligence layering** — three distinct layers, each with one job:
1. `intelligence/*Engine.js` — one engine per concept (readiness, fatigue, plateau, deload, balance, volume landmarks, exercise insights, muscle priority, weekly grade, smart insights). Each is a pure function over workout/goal data already fetched by the page. Repvyn deliberately has no muscle-specific physiological recovery-time engine — the evidence for individualized recovery estimation isn't strong enough to present as fact.
2. `progression/*` — progression-specific metrics, filters, and insights (separate from `intelligence/` because progression predates the Phase 14 intelligence layer and has its own chart-shaping concerns).
3. `trainingIntelligence/*` — the orchestrator. Every UI surface (Dashboard, Analytics, Progression, Workout History, Planner, Notification Center) imports from here, not from the engines directly, so each number a user sees traces back to exactly one engine call with no duplicated logic per page.

**Reminders**: `reminders/reminderEngine.js` merges candidates from eight generator modules (workout, goal, streak, neglect, cardio, planner, achievement, intelligence reminders), applies user category preferences, prioritizes, and groups them — this is the one place that assembles the final reminder list; no page builds its own subset.

## Major data flows

**Finish a workout session** — `POST /api/workouts/session` → validate payload → verify every referenced exercise is owned by the user → insert all `Workout` documents for the session → best-effort, independently try/caught: link to a `PlannedWorkout` if this completed one, suppress now-stale neglect reminders for trained muscles, recalculate affected goals, detect and persist PR/streak/completion notifications. A failure in goal recalculation or notification generation is reported back in the response but never rolls back the session save itself.

**Notification → push delivery** — a notification is created through `notificationService.js` (dedup by `dedupeKey`, confidence/priority resolved from `constants/notificationTypes.js`) → `pushDeliveryManager.js` checks push eligibility + user quiet-hours/preferences → sends via `web-push` to every subscribed device → the service worker (`client/public/service-worker.js`) shows the OS notification and, on click, deep-links back into the SPA using the same page/entityId/focus vocabulary `NotificationCenter.jsx` uses for in-app clicks (necessarily duplicated once, since a service worker can't import React code — documented in the service worker's own header comment).

**Auth** — email/password issues a JWT signed with `JWT_SECRET` on successful bcrypt compare; Google Sign-In verifies the client's ID token against `GOOGLE_CLIENT_ID` via `google-auth-library` and issues the same kind of JWT. Every subsequent request carries that JWT as a Bearer token; `protect` is the only thing that ever trusts it.
