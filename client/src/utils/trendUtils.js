// Phase 14A — trend classification shared across the intelligence/
// modules. Re-exports progression/progressionEngine.js's trend
// primitives (describeTrend/compareRecentPeriods/compareSessionHalves)
// so every intelligence/ file imports trend math from ONE place
// (utils/trendUtils.js) rather than reaching into progression/ directly
// — the dependency direction stays intelligence/ -> utils/ ->
// progression/, and this file is the one spot to add NEW trend
// classification without touching progressionEngine.js itself.
export { describeTrend, compareRecentPeriods, compareSessionHalves } from "../progression/progressionEngine";

// Matches the phase spec's own example ("No improvement, 5 sessions")
// for when a plateau becomes worth mentioning at all, and a second,
// higher bar for when it's worth calling "Confirmed" rather than a
// still-could-be-noise "Possible".
const MIN_SESSIONS_POSSIBLE = 5;
const MIN_SESSIONS_CONFIRMED = 8;

// Plateau classification — shared by Module 3 (Plateau Detection) and
// Module 6 (Deload Detection, which needs "is this stalled" as one of
// its own trigger inputs). One algorithm, two consumers, rather than
// each re-deriving "what counts as a plateau".
//
// `trend` is a describeTrend/compareSessionHalves result (or null when
// there isn't enough history for one), `sessionCount` is how many real
// data points backed it — a `direction: "down"` or `"flat"` off of only
// 3 sessions isn't the same claim as the same reading off of 10.
export function classifyPlateau(trend, sessionCount) {
  if (!trend || sessionCount == null) return "None";
  if (trend.direction === "up") return "None";
  if (sessionCount >= MIN_SESSIONS_CONFIRMED) return "Confirmed";
  if (sessionCount >= MIN_SESSIONS_POSSIBLE) return "Possible";
  return "None";
}

// The spec's "Lat Pulldown — Volume increasing / Weight stagnant" case:
// a real plateau in LOAD (working weight / estimated 1RM trend flat or
// down) that would otherwise be masked because volume (more sets/reps
// at the same weight) is still climbing. Both trends must already exist
// (real describeTrend results) for this to fire — nothing here invents
// a comparison out of insufficient data.
export function isVolumeMaskedPlateau(weightTrend, volumeTrend) {
  if (!weightTrend || !volumeTrend) return false;
  return weightTrend.direction !== "up" && volumeTrend.direction === "up";
}
