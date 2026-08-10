
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Repvyn", {
      body: payload.body || "",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: payload.notificationId,
      data: payload,
    })
  );
});

function buildTargetUrl(payload) {
  const origin = self.location.origin;
  const { action, navigationTarget, notificationId } = payload;

  let path = navigationTarget || "/dashboard";
  if (action?.focus && action.entityId) {
    switch (action.focus) {
      case "expandSession":
        path = `/workouts?expandSession=${encodeURIComponent(action.entityId)}`;
        break;
      case "scrollToGoal":
        path = `/goals?focusGoal=${encodeURIComponent(action.entityId)}`;
        break;
      case "date":
        path = `/calendar?date=${encodeURIComponent(action.entityId)}`;
        break;
      default:
        break;
    }
  }

  const url = new URL(path, origin);
  if (notificationId) url.searchParams.set("pushClick", notificationId);
  return url.toString();
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const payload = event.notification.data || {};
  const targetUrl = buildTargetUrl(payload);

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = allClients.find((c) => c.url.startsWith(self.location.origin));

      if (existing) {
        await existing.navigate(targetUrl);
        await existing.focus();
        return;
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});

