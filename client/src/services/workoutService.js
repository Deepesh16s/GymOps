import api from "./api";

// Raw workout documents, used by anything that needs to derive its own
// client-side breakdown (muscle map, analytics trends) rather than a
// single backend-precomputed aggregate. Same endpoint/shape Analytics.jsx
// already relies on.
export const getWorkouts = (limit = 500) =>
  api.get("/workouts", { params: { limit } });
