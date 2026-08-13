import { apiRequest } from "./client";
import type { NormalizedRecord } from "../health/normalize";
import type { TrackedRecordType } from "../health/recordTypes";

export interface ConnectionStatus {
  connected: boolean;
  connectedAt: string | null;
  grantedRecordTypes: string[];
  syncState: Partial<Record<TrackedRecordType, { lastSyncedAt: string | null }>>;
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
