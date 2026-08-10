import api from "./api";

export const getDailySteps = (params = {}) => api.get("/daily-steps", { params });

export const setDailySteps = (date, steps) => api.put("/daily-steps", { date, steps });
