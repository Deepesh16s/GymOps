# Repvyn Android Companion

Phase 2 of Repvyn's Health & Wearable Integration: an Android bridge between
Health Connect and the Repvyn API. Prioritized record types for this phase:
heart rate, resting heart rate, HRV, steps, active calories, sleep, exercise
sessions.

This is the seed of the eventual full Repvyn Android app, not a throwaway
prototype — see the package identity note below.

## Architecture

```
Wearable → manufacturer app → Android Health Connect
    → Repvyn companion (this app) → Repvyn API → MongoDB
```

Health Connect has no cloud/server API — it's on-device only, so this app is
the only possible bridge between a user's watch data and Repvyn's backend.

## Stack

- Expo SDK 57, React Native 0.86, TypeScript
- `react-native-health-connect` (via Expo config plugin + EAS custom dev
  client — **not** compatible with Expo Go)
- `expo-secure-store` for the JWT, `@react-native-async-storage/async-storage`
  for the non-sensitive "user chose to connect" flag

## Local setup

Requires a real Android device or emulator — Health Connect cannot be tested
in Expo Go. This machine has no local Java/Android SDK, so builds must go
through EAS (cloud build, free tier) rather than `expo run:android`.

```bash
cd mobile
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_URL — see comments in .env.example

npx expo prebuild --platform android   # regenerates ./android (gitignored)
eas login                               # first time only
eas build --profile development --platform android
# install the resulting APK on a device, then:
npx expo start --dev-client
```

On a physical device, `localhost` resolves to the phone itself, not your
dev machine — use the deployed Render API URL from `.env.example` instead.
`EXPO_PUBLIC_API_URL` is inlined into the JS bundle at build time (same as
Vite's `VITE_`-prefixed vars on the web client), so changing `.env` alone
does nothing to an already-installed build — a new `eas build` is required
before the change takes effect. `npx expo start --dev-client` only reloads
JS/Metro state on top of the native shell that was already built; it can't
retroactively change a value that got baked in.

## Project structure

```
src/
  api/       Generic authenticated fetch client + typed endpoint wrappers
  auth/      JWT session (SecureStore-backed), reused as-is by any future screen
  health/    Health Connect integration — isolated from UI on purpose so it
             can become one subsystem of a larger app rather than something
             to unwind later
  screens/   Login, Home (connection status + sync), Permission Rationale
  theme/     Color/spacing tokens mirrored from the web app's design system
```

No navigation library yet — three screens with a genuinely linear flow don't
need one. Screens are self-contained components that would drop into
`@react-navigation` (or Expo Router) without rework once the app grows past
this.

## Package identity

`com.repvyn.app` / bundle id `com.repvyn.app` — deliberately **not**
`com.repvyn.companion`. Android package names are permanent after the first
Play Store publish; since this app is meant to grow into the full Repvyn
mobile client rather than being replaced, the identity was set to the
eventual product name from day one.

## What's NOT built yet (by design, out of Phase 2 scope)

- Health & Activity Insights UI (charts and trends from connected health/activity data) — Phase 4
- Background sync (WorkManager/`expo-task-manager`) — sync currently runs on
  app-open and via a manual "Sync Now" button only; `BackgroundAccessPermission`
  is intentionally not requested until a background job actually uses it
  (least-privilege: don't ask for a permission before the feature exists)
- Auto-routing to the Permission Rationale screen when Android launches the
  app via the system's `VIEW_PERMISSION_USAGE` intent — the manifest-level
  requirement (which gates whether permission requests work at all) is fully
  wired via the config plugin; only the "jump straight to the rationale
  screen" convenience needs reading the launch intent's action string, which
  isn't exposed through Expo's JS APIs and would need a small native addition
- Apple HealthKit — Phase 6, Android-only for now
