# Release Checklist — Phase 17C

Status as of this audit. **VERIFIED** = actually executed/inspected and confirmed working in this pass. **NOT VERIFIED** = not tested (tooling unavailable or out of scope for a non-browser session) — do not treat as passing. **MANUAL ACTION REQUIRED** = a decision or one-time setup step only a human/deployer can do.

## Environment variables
- **VERIFIED** — every `process.env.*` read in `server/` and `import.meta.env.*` read in `client/src/` is now documented in `server/.env.example` / `client/.env.example`, cross-checked by grep against actual usage (no undocumented variable, no documented-but-unused variable).
- **VERIFIED** — both `.env` files are git-ignored and were confirmed absent from the current tracked tree.
- **MANUAL ACTION REQUIRED** — set real production values (especially `JWT_SECRET`, `MONGO_URI`, `CLIENT_URL`) on whatever host runs the server; they are local-only right now.

## Database
- **VERIFIED** — server successfully connected to the configured MongoDB (Atlas) instance on a real boot during this audit.
- **VERIFIED** — no seed/index script is required beyond what Mongoose creates from the schemas.
- **NOT VERIFIED** — behavior under production load / connection pool sizing (never load-tested).
- **MANUAL ACTION REQUIRED** — if deploying to a fresh Atlas project, allow-list the API host's outbound IP (or use "allow from anywhere" with a strong password).

## Authentication
- **VERIFIED** — email/password: bcrypt hashing, JWT issuance/verification, ownership checks on every protected resource, forgot/reset-password flow does not leak account existence, reset tokens are hashed at rest and time-limited (15 min).
- **NOT VERIFIED** — full Google OAuth browser round trip (consent screen → ID token → account creation/login). Server-side verification code was read and appears correct, but no browser was available to exercise it end-to-end this session.
- **NOT VERIFIED** — actual password-reset email delivery (did not trigger a real send using the configured Gmail account).

## Google OAuth
- **NOT VERIFIED** — see Authentication above. Confirm the OAuth client's authorized JavaScript origins in Google Cloud Console include every environment's URL (localhost during dev, the real deployed origin in production) before relying on it.

## Build
- **VERIFIED** — `npm run build` in `client/` completed successfully (2627 modules, no errors) during this audit.
- **VERIFIED** — server boots cleanly under plain `node server.js` (not just `nodemon`).

## Lint
- **VERIFIED** — `npm run lint` in `client/` passed with 0 errors (2 pre-existing `react-hooks/exhaustive-deps` warnings, not addressed — see note below).
- **NOT VERIFIED / NOT APPLICABLE** — no lint script or config exists for `server/`.

## API health
- **VERIFIED** — every route file's declared endpoints were read and cross-checked against their controllers (see `docs/API.md`); no documented endpoint is fictional.
- **VERIFIED** — auth guard (`protect`) and ObjectId validation are present on every route that needs them; verified by reading all 9 route files.
- **NOT VERIFIED** — no live HTTP requests were made against the running server (e.g. via curl/Postman) in this session; verification here is by code reading + a clean boot, not by exercising the endpoints.

## Frontend
- **VERIFIED** — production build succeeds; route-level code splitting is in place (auth pages eager, everything else lazy).
- **NOT VERIFIED** — actual rendering/interaction in a browser (no browser tool available this session).

## CORS
- **VERIFIED** — production mode locks CORS to `CLIENT_URL`; development leaves it permissive (existing, intentional behavior).
- **MANUAL ACTION REQUIRED** — `CLIENT_URL` must exactly match the deployed frontend origin, or every request will be rejected once `NODE_ENV=production` is set.

## Security
- **VERIFIED** — Helmet enabled (CSP intentionally off — pure JSON API, no HTML templates to protect); `compression` enabled; auth endpoints rate-limited (register/login and forgot-password separately); every `:id` param validated as an ObjectId before reaching a controller; malformed JSON bodies return 400, not 500; unhandled errors return a generic message with no stack trace leakage; every controller enforces per-resource ownership (no IDOR found across any of the 9 controllers read).
- **VERIFIED** — no secrets in current git history beyond a non-sensitive Google OAuth Client ID (client IDs are meant to be public) from a since-removed `client/.env` commit.
- **MANUAL ACTION REQUIRED** — `DELETE /api/auth/account` deletes only the `User` document; workouts, goals, exercises, notifications, etc. are not cascade-deleted and become orphaned. Decide whether that's acceptable or needs a cleanup pass — not fixed here since it's a data-retention/product decision, not a clear bug.

## Browser QA
- **NOT VERIFIED** — no browser or Playwright tool was available in this session. Needs a manual pass (or a follow-up session with browser tooling) covering: login/register/Google sign-in, live workout session timer, all modals, notification center, calendar, planner.

## Mobile QA
- **NOT VERIFIED** — no device/viewport testing performed.

## Accessibility
- **NOT VERIFIED** — no screen-reader testing performed. Some baseline signals exist in code (e.g. `role="status"`/`aria-label` on the route loading indicator, a dedicated `useModalEscapeAndFocus` hook for modal keyboard handling), but focus-trap correctness and screen-reader flow were not exercised.

## Known code-quality items not fixed (flagged, not blocking)
- Two pre-existing `react-hooks/exhaustive-deps` ESLint warnings (`AddWorkoutModal.jsx`, `dashboard.jsx`) — left as-is per audit scope (no functional bug identified).
- `server/scripts/*.js` are already-applied, one-off migrations with no remaining purpose beyond historical reference (see `docs/ARCHITECTURE.md`).

## Overall status

**Not production-ready to flip a switch on today**, but no blocking backend defect was found. The gap is entirely verification, not implementation: Google OAuth's real browser flow, email delivery, and all UI/mobile/accessibility QA are unverified because no browser was available this session. Everything that could be checked without a browser (dependencies, dead files, env config, security posture, ownership checks, build, lint, server boot) checks out clean.
