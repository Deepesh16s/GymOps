import api from "./api";

export const getNotifications = (limit = 50) => api.get("/notifications", { params: { limit } });

export const markNotificationRead = (id) => api.put(`/notifications/${id}/read`);

export const markAllNotificationsRead = () => api.put("/notifications/read-all");

export const dismissNotification = (id) => api.put(`/notifications/${id}/dismiss`);

export const clearReadNotifications = () => api.put("/notifications/clear-read");

export const generateNotifications = (candidates) =>
  api.post("/notifications/generate", { candidates });

export const snoozeNotification = (id, until) =>
  api.put(`/notifications/${id}/snooze`, { until });
