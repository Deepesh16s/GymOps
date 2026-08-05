// generateDashboardInsights — merges utils/dashboardInsights.js's
// EXISTING retrospective insights (`getDashboardInsights`, pre-dating
// Phase 14A: recent PR, weekly streak, volume trend) with Phase 14A
// Module 12's `getSmartInsights` (plain-language sentences composed from
// the OTHER 11 intelligence engines). Two distinct engines, composed
// here rather than one being folded into or duplicating the other —
// dashboardInsights.js's own header comment explicitly frames it as
// staying its own thing, not a subset of the intelligence layer.
import { getDashboardInsights } from "../utils/dashboardInsights";
import { getSmartInsights } from "../intelligence";

export function generateDashboardInsights(workouts) {
  const existing = getDashboardInsights(workouts); // [{ key, tone, title, detail }]
  const smart = getSmartInsights(workouts); // string[]

  return {
    existing,
    smart,
    // A single flat list for callers that just want "everything worth
    // saying right now" without caring which engine it came from.
    combined: [...existing.map((i) => `${i.title} — ${i.detail}`), ...smart],
  };
}
