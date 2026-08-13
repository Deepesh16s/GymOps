import { apiRequest } from "./client";
import type { NormalizedRecord } from "../health/normalize";

export interface ConnectionStatus {
  connected: boolean;
  connectedAt: string | null;
  grantedRecordTypes: string[];
  // One cursor covers every tracked type (see SyncBatchRequest below), so this
  // is a single flat status, not one per record type.
  syncState: { lastSyncedAt: string | null };
}

export function getConnectionStatus(): Promise<ConnectionStatus> {
  return apiRequest<ConnectionStatus>("/health/connection-status");
}

export function registerConnection(grantedRecordTypes: string[]): Promise<{ message: string }> {
  return apiRequest("/health/connect", {
    method: "POST",
    body: { grantedRecordTypes, platform: "android" },
  });
}

export function disconnect(deleteData: boolean): Promise<{ message: string }> {
  return apiRequest("/health/connect", { method: "DELETE", body: { deleteData } });
}

export interface SyncStateResponse {
  changesToken: string | null;
  lastSyncedAt: string | null;
}

export function getSyncState(): Promise<SyncStateResponse> {
  return apiRequest<SyncStateResponse>("/health/sync-state");
}

// One combined cursor covers the whole tracked-type set (Health Connect's own
// getChanges API accepts multiple record types per token), so a batch can mix
// record types rather than requiring one round trip per type.
export interface SyncBatchRequest {
  records: NormalizedRecord[];
  deletedRecordIds: string[];
  changesToken: string | null;
}

export interface SyncBatchResponse {
  message: string;
  upserted: number;
  deleted: number;
}

export function syncBatch(batch: SyncBatchRequest): Promise<SyncBatchResponse> {
  return apiRequest<SyncBatchResponse>("/health/sync", { method: "POST", body: batch });
}

export function deleteAllHealthData(): Promise<{ message: string; deletedCount: number }> {
  return apiRequest("/health/data", { method: "DELETE" });
}

// Read-only presentation data derived from already-synced records. Each field
// is null when nothing has been synced for that type yet — never a fake zero.
export interface HealthSummary {
  date: string; // UTC calendar day the "today" aggregates (steps, calories) cover
  steps: { total: number; unit: string } | null;
  activeCalories: { total: number; unit: string } | null;
  heartRate: { value: number; unit: string; time: string } | null;
  restingHeartRate: { value: number; unit: string; time: string } | null;
  heartRateVariability: { value: number; unit: string; time: string } | null;
  exercise: { exerciseType: number | null; title: string | null; startTime: string; endTime: string } | null;
  sleep: { startTime: string; endTime: string; durationMinutes: number } | null;
}

export function getHealthSummary(): Promise<HealthSummary> {
  return apiRequest<HealthSummary>("/health/summary");
}
