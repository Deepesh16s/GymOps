import { useCallback, useEffect, useState } from "react";
import {
  registerPushSubscription,
  removePushSubscription,
  getPushPreferences,
  updatePushPreferences,
} from "../services/pushService";

// Phase 13D, Part B (section 15) — Progressive Enhancement: this is the
// ONE place that checks browser support. Every consumer reads `supported`
// off this hook rather than re-checking `'serviceWorker' in navigator`
// itself, so there's exactly one source of truth for "can this browser
// even do push" and nothing downstream has to guess.
const isPushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

// Web Push subscriptions need the VAPID public key as a raw Uint8Array,
// not the base64url string it's stored/shared as — this is the standard
// conversion every web-push client-side integration needs (there's no
// browser-native helper for it).
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Phase 13D, Part B — the one hook every push-related UI reads from:
// support/permission/subscription state, the subscribe/unsubscribe
// actions (section 7), and server-side push preferences (section 10's
// quiet hours + the master pushEnabled switch). Section 5's "do not
// repeatedly prompt after denial" is satisfied structurally, not by an
// extra guard here — `requestAndSubscribe` only ever runs when a caller
// explicitly invokes it (never on mount), and the browser itself refuses
// to show a second permission prompt once denied regardless of how many
// times `Notification.requestPermission()` is called.
export default function usePushNotifications() {
  const supported = isPushSupported();
  const [permission, setPermission] = useState(() =>
    supported ? window.Notification.permission : "unsupported"
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState(null);

  useEffect(() => {
    if (!supported) return;

    navigator.serviceWorker.register("/service-worker.js").catch((error) => console.log(error));

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((existing) => setSubscribed(!!existing))
      .catch((error) => console.log(error));

    getPushPreferences()
      .then((res) => setPreferences(res.data))
      .catch((error) => console.log(error));
  }, [supported]);

  const requestAndSubscribe = useCallback(async () => {
    if (!supported) return false;
    setLoading(true);
    try {
      const result = await window.Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return false;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
      });
      await registerPushSubscription(subscription.toJSON());
      setSubscribed(true);
      setPreferences((prev) => (prev ? { ...prev, pushEnabled: true } : prev));
      return true;
    } catch (error) {
      console.log(error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const updatePreferences = useCallback(async (updates) => {
    try {
      const res = await updatePushPreferences(updates);
      setPreferences(res.data);
    } catch (error) {
      console.log(error);
    }
  }, []);

  return {
    supported,
    permission,
    subscribed,
    loading,
    preferences,
    requestAndSubscribe,
    unsubscribe,
    updatePreferences,
  };
}
