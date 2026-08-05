import api from "./api";

// Single place every Dashboard.jsx request goes through. Previously
// Dashboard.jsx rebuilt an Authorization header manually per call
// (duplicating what api.js's request interceptor already does for
// every other page) — these just call the shared `api` instance
// directly, so there is exactly one place auth headers are attached.
export const getSessionSummary = () => api.get("/dashboard/session-summary");

export const getCurrentStreak = () => api.get("/dashboard/current-streak");

export const getTopExercise = () => api.get("/dashboard/top-exercise");

export const getTopMuscle = () => api.get("/dashboard/top-muscle");

export const getPersonalRecords = () => api.get("/dashboard/personal-records");

export const getRecentSessions = (limit = 6) =>
  api.get("/dashboard/recent-sessions", { params: { limit } });

export const getMuscleDistribution = (range) =>
  api.get("/dashboard/muscle-distribution", { params: { range } });

// Fetches every Dashboard summary widget's data in parallel (unchanged
// from Dashboard.jsx's prior Promise.all — these are independent
// resources, not sequential dependencies, so parallel fetch is already
// correct and is preserved here, just centralized). Weekly Volume is
// computed client-side from muscleWorkouts (trailing 7d/30d/365d filter)
// instead of a fixed calendar-week backend endpoint.
export const getDashboardSummaryData = () =>
  Promise.all([
    getSessionSummary(),
    getCurrentStreak(),
    getTopExercise(),
    getTopMuscle(),
    getPersonalRecords(),
    getRecentSessions(6),
  ]);
