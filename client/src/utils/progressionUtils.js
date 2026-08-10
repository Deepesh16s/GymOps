import { getConfidenceReason } from "./confidenceUtils";

const WEIGHT_INCREMENT_KG = 2.5;
const REP_INCREMENT = 1;
const MIN_SESSIONS_FOR_SUGGESTION = 4;
const MIN_SESSIONS_FOR_HIGH_CONFIDENCE = 8;

function roundToHalf(n) {
  return Math.round(n * 2) / 2;
}

export function suggestNextTarget({ lastSet, weightTrend, sessionCount = 0 }) {
  if (!lastSet) return null;
  const { weight, reps } = lastSet;

  if (weightTrend && sessionCount >= MIN_SESSIONS_FOR_SUGGESTION) {
    if (weightTrend.direction === "up") {
      return {
        metric: "weight",
        current: { weight, reps },
        suggested: { weight: roundToHalf(weight + WEIGHT_INCREMENT_KG), reps },
        confidence: sessionCount >= MIN_SESSIONS_FOR_HIGH_CONFIDENCE ? "High" : "Medium",
        confidenceReason: getConfidenceReason(sessionCount, "session"),
        reason: `Working weight has trended up over the last ${sessionCount} sessions.`,
      };
    }

    if (weightTrend.direction === "flat") {
      return {
        metric: "reps",
        current: { weight, reps },
        suggested: { weight, reps: reps + REP_INCREMENT },
        confidence: sessionCount >= MIN_SESSIONS_FOR_HIGH_CONFIDENCE ? "Medium" : "Low",
        confidenceReason: getConfidenceReason(sessionCount, "session"),
        reason: "Weight has held steady — add a rep before adding load.",
      };
    }
  }

  return {
    metric: "hold",
    current: { weight, reps },
    suggested: { weight, reps },
    confidence: "Low",
    confidenceReason: getConfidenceReason(sessionCount, "session"),
    reason:
      weightTrend?.direction === "down"
        ? "Working weight has trended down recently — hold steady and let it stabilize."
        : "Not enough recent sessions to confidently suggest a change yet.",
  };
}
