import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
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
import {
  registerConnection,
  disconnect as disconnectOnServer,
  deleteAllHealthData,
  getConnectionStatus,
  getHealthSummary,
  type HealthSummary,
} from "../api/health";

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
  // Server-persisted, unlike lastSyncResult — survives app restart because it's
  // re-fetched from the backend rather than kept only in this session's memory.
  lastSyncedAt: string | null;
  summary: HealthSummary | null;
  // Whether the in-flight (or about-to-start) sync is the first/historical
  // import rather than a quick incremental sync — derived from lastSyncedAt
  // being null, the same condition runSync() itself uses to decide (see
  // health/sync.ts), so this never has to guess independently.
  isHistoricalSync: boolean;
  error: string | null;
}

const DISCONNECTED_STATE: Omit<State, "phase"> = {
  lastSyncResult: null,
  lastSyncedAt: null,
  summary: null,
  isHistoricalSync: false,
  error: null,
};

// A sync that resolves (doesn't throw) can still be partial/failed per-type
// (historical import) or per-chunk (either mode) — surface that through the
// same error text the UI already renders, rather than silently reporting
// success on an incomplete sync.
function syncIssueMessage(result: SyncResult): string | null {
  if (result.status === "success") return null;
  if (result.status === "failed") return "Sync failed. It will retry automatically next time.";
  return "Some health data couldn't sync and will retry next time.";
}

export function useHealthConnection() {
  const [state, setState] = useState<State>({ phase: "checking", ...DISCONNECTED_STATE });
  const phaseRef = useRef(state.phase);
  phaseRef.current = state.phase;

  // Presentation-only data. A failed fetch here shouldn't affect the
  // connection phase itself — that's derived from the on-device Health
  // Connect permission grant, which remains authoritative regardless of
  // whether the backend is reachable right now.
  const refreshServerData = useCallback(async () => {
    try {
      const status = await getConnectionStatus();
      setState((s) => ({ ...s, lastSyncedAt: status.syncState.lastSyncedAt }));
    } catch {
      // leave lastSyncedAt as-is; next refresh (sync, reconnect, relaunch) retries
    }
    try {
      const summary = await getHealthSummary();
      setState((s) => ({ ...s, summary }));
    } catch {
      // leave summary as-is
    }
  }, []);

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
    await refreshServerData();
  }, [refreshServerData]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Re-checks Health Connect permission status when the app returns to the
  // foreground, so a permission revoked from outside the app (e.g. from
  // Health Connect's own settings) while Repvyn was merely backgrounded is
  // caught without needing a full cold relaunch. Skipped while a connect/sync
  // is actively in flight so it can't clobber that operation's own phase
  // transitions — refreshStatus() itself only ever reads status, it never
  // triggers a sync, so this can't cause an unexpected historical import.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState !== "active") return;
      const currentPhase = phaseRef.current;
      if (currentPhase === "checking" || currentPhase === "connecting" || currentPhase === "syncing") return;
      refreshStatus();
    });
    return () => subscription.remove();
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

      // A brand-new connection has no prior sync, so this is always the
      // historical import — no extra round trip needed to know that.
      setState((s) => ({ ...s, phase: "syncing", isHistoricalSync: true }));
      const result = await runSync();
      setState((s) => ({
        ...s,
        phase: "connected",
        lastSyncResult: result,
        isHistoricalSync: false,
        error: syncIssueMessage(result),
      }));
      await refreshServerData();
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "not_connected",
        isHistoricalSync: false,
        error: err instanceof Error ? err.message : "Failed to connect.",
      }));
    }
  }, [refreshServerData]);

  const sync = useCallback(async () => {
    const isFirstSync = state.lastSyncedAt === null;
    setState((s) => ({ ...s, phase: "syncing", isHistoricalSync: isFirstSync, error: null }));
    try {
      const result = await runSync();
      setState((s) => ({
        ...s,
        phase: "connected",
        lastSyncResult: result,
        isHistoricalSync: false,
        error: syncIssueMessage(result),
      }));
      await refreshServerData();
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "connected",
        isHistoricalSync: false,
        error: err instanceof Error ? err.message : "Sync failed.",
      }));
    }
  }, [state.lastSyncedAt, refreshServerData]);

  const disconnect = useCallback(async (options: { deleteData: boolean }) => {
    await disconnectOnServer(options.deleteData);
    if (options.deleteData) await deleteAllHealthData();
    await AsyncStorage.removeItem(CONNECTED_FLAG_KEY);
    setState({ phase: "not_connected", ...DISCONNECTED_STATE });
  }, []);

  return { ...state, connect, sync, disconnect, openHealthConnectSettings, refreshStatus };
}
