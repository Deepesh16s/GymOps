// Phase 14B — Training Intelligence Orchestrator. The single entry point
// every UI surface (Dashboard, Analytics, Progression, Workout History,
// Planner, Notification Center) and future features (Phase 15's AI
// Coach) should import from — composes Phase 14A's intelligence/ engines
// (and utils/dashboardInsights.js where already established) into the
// exact shapes each surface needs. No business logic lives here beyond
// composition: every number traces back to exactly one engine call in
// client/src/intelligence/.
export { generateTrainingBrief } from "./generateTrainingBrief";
export { generateDashboardInsights } from "./generateDashboardInsights";
export { generateWeeklyCoachReport } from "./generateWeeklyCoachReport";
export { generateExerciseRecommendations } from "./generateExerciseRecommendations";
export { generateRecoverySummary } from "./generateRecoverySummary";
export { generatePrioritySummary } from "./generatePrioritySummary";
export { generateSessionIntelligence } from "./generateSessionIntelligence";
export { generateCoachPriority } from "./generateCoachPriority";
