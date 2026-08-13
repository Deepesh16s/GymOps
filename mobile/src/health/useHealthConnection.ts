import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  checkAvailability,
  requestHealthPermissions,
  getGrantedHealthPermissions,
  hasAllTrackedPermissions,
  openHealthConnectSettings,
  type Availability,
} from "./healthConnectClient";
import { runSync, type SyncResult } from "./sync";
import { registerConnection, disconnect as disconnectOnServer, deleteAllHealthData } from "../api/health";

// Whether the *user chose* to connect health data, tracked locally rather than
// derived from the OS permission grant. This is deliberate: react-native-health-connect's
// revokeAllPermissions() does not take effect until the app process restarts
// (a documented Health Connect platform limitation, confirmed in the library's
// own source), so it cannot be the mechanism behind a "Disconnect" button.
// Disconnecting here means: stop syncing and tell the backend, and send the
// user to Health Connect's own settings if they also want to revoke the OS grant.
const CONNECTED_FLAG_KEY = "repvyn_health_connected";

export type ConnectionPhase =
  | "checking"
  | "unsupported"
  | "update_required"
  | "not_connected"
  | "connecting"
  | "connected"
  | "syncing"
  | "permission_revoked";

interface State {
  phase: ConnectionPhase;
  lastSyncResult: SyncResult | null;
  error: string | null;
}

export function useHealthConnection() {
  const [state, setState] = useState<State>({ phase: "checking", lastSyncResult: null, error: null });

  const refreshStatus = useCallback(async () => {
    const availability: Availability = await checkAvailability();
    if (availability !== "available") {
      setState((s) => ({ ...s, phase: availability === "update_required" ? "update_required" : "unsupported" }));
      return;
    }

    const wasConnected = (await AsyncStorage.getItem(CONNECTED_FLAG_KEY)) === "true";
    if (!wasConnected) {
      setState((s) => ({ ...s, phase: "not_connected" }));
      return;
    }

    // Detect permission changes made outside the app (e.g. the user revoked
    // access from Health Connect's own settings screen) rather than trusting
    // our own stale "connected" flag.
    const granted = await getGrantedHealthPermissions();
    if (!hasAllTrackedPermissions(granted)) {
      setState((s) => ({ ...s, phase: "permission_revoked" }));
      return;
    }

    setState((s) => ({ ...s, phase: "connected" }));
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, phase: "connecting", error: null }));
    try {
      const granted = await requestHealthPermissions();
      if (!hasAllTrackedPermissions(granted)) {
        setState((s) => ({ ...s, phase: "not_connected", error: "Not all permissions were granted." }));
        return;
      }

      await registerConnection(granted.map((p) => p.recordType));
      await AsyncStorage.setItem(CONNECTED_FLAG_KEY, "true");

      setState((s) => ({ ...s, phase: "syncing" }));
      const result = await runSync();
      setState({ phase: "connected", lastSyncResult: result, error: null });
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "not_connected",
        error: err instanceof Error ? err.message : "Failed to connect.",
      }));
    }
  }, []);

  const sync = useCallback(async () => {
    setState((s) => ({ ...s, phase: "syncing", error: null }));
    try {
      const result = await runSync();
      setState((s) => ({ ...s, phase: "connected", lastSyncResult: result }));
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "connected",
        error: err instanceof Error ? err.message : "Sync failed.",
      }));
    }
  }, []);

  const disconnect = useCallback(async (options: { deleteData: boolean }) => {
    await disconnectOnServer(options.deleteData);
    if (options.deleteData) await deleteAllHealthData();
    await AsyncStorage.removeItem(CONNECTED_FLAG_KEY);
    setState({ phase: "not_connected", lastSyncResult: null, error: null });
  }, []);

  return { ...state, connect, sync, disconnect, openHealthConnectSettings, refreshStatus };
}
