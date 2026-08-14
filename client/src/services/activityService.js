import api from "./api";

export const getFeed = (before) => api.get("/activity", { params: before ? { before } : {} });
