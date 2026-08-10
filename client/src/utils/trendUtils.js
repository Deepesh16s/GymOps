export { describeTrend, compareRecentPeriods, compareSessionHalves } from "../progression/progressionEngine";

const MIN_SESSIONS_POSSIBLE = 5;
const MIN_SESSIONS_CONFIRMED = 8;

export function classifyPlateau(trend, sessionCount) {
  if (!trend || sessionCount == null) return "None";
  if (trend.direction === "up") return "None";
  if (sessionCount >= MIN_SESSIONS_CONFIRMED) return "Confirmed";
  if (sessionCount >= MIN_SESSIONS_POSSIBLE) return "Possible";
  return "None";
}

export function isVolumeMaskedPlateau(weightTrend, volumeTrend) {
  if (!weightTrend || !volumeTrend) return false;
  return weightTrend.direction !== "up" && volumeTrend.direction === "up";
}
