import api from "./api";

// Thin wrapper around /api/daily-steps — a plain "set today's total" log,
// deliberately separate from workoutService.js (steps are a passive
// all-day count, not a logged cardio session). getDailySteps accepts an
// optional {from, to} range (both "YYYY-MM-DD"); omitting both lets the
// server default to its own lookback window.
export const getDailySteps = (params = {}) => api.get("/daily-steps", { params });

export const setDailySteps = (date, steps) => api.put("/daily-steps", { date, steps });
