import api from "./api";

// Phase 13D, Part B — thin wrapper around /api/push, same pattern as
// every other service file in this app (notificationService.js,
// goalService.js, ...).
export const getPushSubscriptions = () => api.get("/push/subscriptions");

export const registerPushSubscription = (subscription) =>
  api.post("/push/subscriptions", { subscription });

export const removePushSubscription = (endpoint) =>
  api.delete("/push/subscriptions", { data: { endpoint } });

export const getPushPreferences = () => api.get("/push/preferences");

export const updatePushPreferences = (updates) => api.put("/push/preferences", updates);

export const markPushClicked = (notificationId) =>
  api.put(`/push/notifications/${notificationId}/clicked`);
