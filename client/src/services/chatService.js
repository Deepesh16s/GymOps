import api from "./api";

export const listConversations = () => api.get("/conversations");

export const createConversation = (username) => api.post("/conversations", { username });

export const getConversation = (id) => api.get(`/conversations/${id}`);

export const getMessages = (id, { before, limit } = {}) =>
  api.get(`/conversations/${id}/messages`, { params: { before, limit } });

export const sendMessage = (id, body) => api.post(`/conversations/${id}/messages`, { body });

export const markConversationRead = (id) => api.put(`/conversations/${id}/read`);

export const deleteMessage = (conversationId, messageId) =>
  api.delete(`/conversations/${conversationId}/messages/${messageId}`);
