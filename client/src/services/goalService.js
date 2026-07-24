import api from "./api";

// Extracted from Goals.jsx's previously-inline api calls (Phase 12) — the
// same centralization workoutService.js/dashboardService.js already
// established for their pages. Behavior-identical, just relocated, so
// Dashboard's new "Active Cardio Goal" widget can reuse getGoals()
// instead of duplicating an inline axios call.
export const getGoals = () => api.get("/goals");

export const createGoal = (payload) => api.post("/goals", payload);

export const updateGoal = (goalId, payload) => api.put(`/goals/${goalId}`, payload);

export const deleteGoal = (goalId) => api.delete(`/goals/${goalId}`);
