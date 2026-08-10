import api from "./api";

export const getPlannedWorkouts = () => api.get("/planned-workouts");

export const createPlannedWorkout = (payload) => api.post("/planned-workouts", payload);

export const updatePlannedWorkout = (id, payload, editScope = "only") =>
  api.put(`/planned-workouts/${id}`, payload, { params: { editScope } });

export const reschedulePlannedWorkout = (id, { scheduledDate, scheduledTime }) =>
  api.put(`/planned-workouts/${id}/reschedule`, { scheduledDate, scheduledTime });

export const markPlannedWorkoutComplete = (id) => api.put(`/planned-workouts/${id}/complete`);

export const duplicatePlannedWorkout = (id, { scheduledDate, scheduledTime }) =>
  api.post(`/planned-workouts/${id}/duplicate`, { scheduledDate, scheduledTime });

export const cancelPlannedWorkout = (id, editScope = "only") =>
  api.put(`/planned-workouts/${id}/cancel`, {}, { params: { editScope } });

export const deletePlannedWorkout = (id, editScope = "only") =>
  api.delete(`/planned-workouts/${id}`, { params: { editScope } });
