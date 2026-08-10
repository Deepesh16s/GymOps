import api from "./api";

export const getGoals = () => api.get("/goals");

export const createGoal = (payload) => api.post("/goals", payload);

export const updateGoal = (goalId, payload) => api.put(`/goals/${goalId}`, payload);

export const deleteGoal = (goalId) => api.delete(`/goals/${goalId}`);
