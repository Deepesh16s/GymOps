import api from "./api";

export const getPhysiquePosts = (username, page = 1, limit = 12) =>
  api.get(`/physique/${username}`, { params: { page, limit } });

export const createPhysiquePost = (formData) =>
  api.post("/physique", formData, { headers: { "Content-Type": "multipart/form-data" } });

export const deletePhysiquePost = (id) => api.delete(`/physique/${id}`);

export const likePhysiquePost = (id) => api.post(`/physique/${id}/like`);

export const unlikePhysiquePost = (id) => api.delete(`/physique/${id}/like`);

export const reactToPhysiquePost = (id, type) => api.post(`/physique/${id}/reactions`, { type });

export const removePhysiqueReaction = (id) => api.delete(`/physique/${id}/reactions`);

export const getPhysiqueComments = (id, page = 1) =>
  api.get(`/physique/${id}/comments`, { params: { page } });

export const createPhysiqueComment = (id, text) => api.post(`/physique/${id}/comments`, { text });

export const deletePhysiqueComment = (commentId) => api.delete(`/physique/comments/${commentId}`);
