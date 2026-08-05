// Phase 13D, Part B — a Service Worker dedicated to notifications only.
// No offline-first rewrite, no cache redesign, no asset precaching —
// this file's entire job is: receive a push, show it, and route a click
// back into the app. Every other responsibility (what a notification
// says, whether it's push-eligible, dedup, priority) already happened
// server-side (see server/utils/pushDeliveryManager.js) before this
// file ever runs; this is pure delivery + click routing.

// Section 6 — Push reception. Payload shape matches
// pushDeliveryManager.js's buildPushPayload exactly.
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "GymOps", {
      body: payload.body || "",
      // lucide icon NAMES aren't real image assets — a generic app icon
      // is used here regardless of which lucide icon the in-app card
      // shows; the notification's actual distinguishing info is its
      // title/body, same as every native OS notification.
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: payload.notificationId, // replaces any still-showing OS notification for the same doc rather than stacking duplicates
      data: payload,
    })
  );
});

// Phase 13C.1's structured `action` (page/entityId/focus) is the single
// source of truth for where a notification deep-links to — this is the
// SAME vocabulary client/src/components/NotificationCenter.jsx's
// buildNavigationTarget already implements for in-app clicks. A service
// worker runs in its own global scope and cannot import that React
// module, so this is a small, deliberate, disclosed duplication of ONE
// switch statement — not a second routing system. See that file's
// header comment for the in-app equivalent.
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
  // Read by App.jsx's bootstrap effect on load to call
  // PUT /api/push/notifications/:id/clicked with the CLIENT's own
  // already-authenticated axios instance — the service worker never
  // holds an auth token itself, so it hands off the click-tracking call
  // to the page once it loads rather than trying to fetch() it here.
  if (notificationId) url.searchParams.set("pushClick", notificationId);
  return url.toString();
}

// Section 6 — notification click handling. Focuses/navigates an
// existing GymOps tab if one is open (via the standard Clients API
// `navigate()`, which does a real navigation the SPA's own deep-link
// effects — Calendar's date focus, WorkoutHistory's expandSession,
// Goals' scrollToGoal, all already built in 13C.1 — pick up exactly as
// if the user had followed a normal link), or opens a new tab otherwise.
// Never a second copy of THOSE focus behaviors — only the URL
// construction above is duplicated, out of necessity.
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

// Section 9/14 — dismissing the OS notification directly (swiping it
// away without clicking) doesn't need its own server round trip: the
// notification is still sitting, unread, in the Notification Center
// exactly as it would be if the push had never been sent — closing the
// OS-level toast doesn't change that in-app state, so there is nothing
// to reconcile here. No listener needed beyond this comment explaining
// why one wasn't added.
