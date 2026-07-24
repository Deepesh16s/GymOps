import api from "./api";

// Raw workout documents, used by anything that needs to derive its own
// client-side breakdown (muscle map, analytics trends) rather than a
// single backend-precomputed aggregate. Same endpoint/shape Analytics.jsx
// already relies on.
export const getWorkouts = (limit = 500) =>
  api.get("/workouts", { params: { limit } });

// Workout Session Editing & Time Tracking. Updates startedAt/endedAt/
// sessionDuration/timingMode across every workout document sharing this
// sessionId in one request — mirrors how deleting a session already
// operates on the whole sessionId group rather than one document.
export const updateSessionTiming = (sessionId, timing) =>
  api.put(`/workouts/session/${sessionId}/timing`, timing);
