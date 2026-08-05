// Phase 14A — "what to do next workout" suggestion math for Module 4
// (Progressive Overload Engine), also reused by Module 9 (Exercise
// Intelligence's "Trend" label) and Module 10 (Weekly Grade's
// progression factor). Pure math over an already-computed trend
// (progression/progressionEngine.js's describeTrend) and the last real
// logged set — never re-derives what a trend or a set is.
import { getConfidenceReason } from "./confidenceUtils";

const WEIGHT_INCREMENT_KG = 2.5; // standard small-plate increment
const REP_INCREMENT = 1;
const MIN_SESSIONS_FOR_SUGGESTION = 4;
const MIN_SESSIONS_FOR_HIGH_CONFIDENCE = 8;

// Rounds to the nearest half unit — a suggested weight should always be
// something actually loadable (2.5kg plates -> 0.5kg smallest fraction
// once split across a barbell), not an arbitrary decimal.
function roundToHalf(n) {
  return Math.round(n * 2) / 2;
}

// Matches the phase spec's two examples exactly: a real upward weight
// trend suggests a small weight bump ("82.5 x 8"); a stalled weight with
// enough session history suggests a rep bump instead ("10 -> 11")
// rather than forcing a weight increase the lifter hasn't earned yet.
// Anything without enough trend history suggests holding steady —
// "not enough data" is an honest answer, not a guess.
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
