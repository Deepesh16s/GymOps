import api from "./api";

// Phase 13A — thin wrapper around /api/notifications, same pattern as
// goalService.js/dailyStepsService.js. `generate` is the client-
// triggered half of notification generation (see
// reminders/reminderEngine.js): the client computes candidates from data
// it already has (via existing engines), and the server dedupes +
// persists them — this call never invents a notification's content,
// only submits what was already computed.
export const getNotifications = (limit = 50) => api.get("/notifications", { params: { limit } });

export const markNotificationRead = (id) => api.put(`/notifications/${id}/read`);

export const markAllNotificationsRead = () => api.put("/notifications/read-all");

export const dismissNotification = (id) => api.put(`/notifications/${id}/dismiss`);

export const clearReadNotifications = () => api.put("/notifications/clear-read");

export const generateNotifications = (candidates) =>
  api.post("/notifications/generate", { candidates });

// Phase 13C, section 11 — until is "today" or "tomorrow"; the server
// resolves that into an actual end-of-day timestamp (see
// controllers/notificationController.js's computeSnoozeUntil).
export const snoozeNotification = (id, until) =>
  api.put(`/notifications/${id}/snooze`, { until });
