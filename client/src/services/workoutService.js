import api from "./api";

export const getWorkouts = (limit = 500) =>
  api.get("/workouts", { params: { limit } });

export const updateSessionTiming = (sessionId, timing) =>
  api.put(`/workouts/session/${sessionId}/timing`, timing);
