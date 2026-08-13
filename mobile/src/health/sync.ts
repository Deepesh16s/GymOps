import type { HealthConnectRecordResult } from "react-native-health-connect";
import { readRecordsForType, fetchChanges } from "./healthConnectClient";
import { normalizeRecord, type NormalizedRecord } from "./normalize";
import { TRACKED_RECORD_TYPES, type TrackedRecordType } from "./recordTypes";
import { getSyncState, syncBatch } from "../api/health";

const HISTORICAL_IMPORT_DAYS = 30; // Health Connect's default read window without
// the extra PERMISSION_READ_HEALTH_DATA_HISTORY grant, which this app does not
// request in Phase 2 (least privilege — add only if a deeper backfill becomes
// a real product need).

// Conservative, record-count-based chunk size for outgoing syncBatch calls, so
// a dense historical import can't produce one unboundedly large request. This
// doesn't perfectly bound payload size — a HeartRate record itself holds a
// nested array of samples — but nothing else in this codebase estimates JSON
// byte size, so a fixed record count matches the project's existing
// conventions rather than introducing a new one just for this.
const SYNC_CHUNK_SIZE = 200;

export type SyncStatus = "success" | "partial" | "failed";

export interface SyncResult {
  imported: number;
  upserted: number;
  deleted: number;
  mode: "historical" | "incremental";
  status: SyncStatus;
  // Only ever non-empty when the historical-import path ran (mode
  // "historical", or an incremental sync's changesTokenExpired fallback) —
  // the Changes API mixes every type into one stream, so an incremental
  // chunk failure isn't attributable to a single record type the way a
  // historical-import failure is.
  failedRecordTypes: TrackedRecordType[];
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

interface ChunkedSyncResult {
  upserted: number;
  deleted: number;
  success: boolean;
}

// Sends records/deletions across multiple bounded syncBatch calls, attaching
// changesToken only to the final chunk so the cursor is persisted exactly
// once, only after every chunk has been accepted — the same single-commit
// cursor semantics the rest of this file already relies on, just extended
// across more than one request when there's enough data to need chunking.
async function syncChunked(
  records: NormalizedRecord[],
  deletedRecordIds: string[],
  changesToken: string | null
): Promise<ChunkedSyncResult> {
  const recordChunks = chunk(records, SYNC_CHUNK_SIZE);
  const deletionChunks = chunk(deletedRecordIds, SYNC_CHUNK_SIZE);
  const totalChunks = Math.max(recordChunks.length, deletionChunks.length, changesToken ? 1 : 0);

  let upserted = 0;
  let deleted = 0;

  for (let i = 0; i < totalChunks; i++) {
    const isLastChunk = i === totalChunks - 1;
    try {
      const result = await syncBatch({
        records: recordChunks[i] ?? [],
        deletedRecordIds: deletionChunks[i] ?? [],
        changesToken: isLastChunk ? changesToken : null,
      });
      upserted += result.upserted;
      deleted += result.deleted;
    } catch {
      // Surface the failure rather than claiming the whole set synced —
      // chunks already sent stay persisted (idempotent upserts keyed on
      // healthConnectRecordId), so a retry safely reprocesses only what
      // didn't get through, never duplicating what did.
      return { upserted, deleted, success: false };
    }
  }

  return { upserted, deleted, success: true };
}

interface HistoricalImportResult {
  recordCount: number;
  failedTypes: TrackedRecordType[];
}

async function runHistoricalImport(): Promise<HistoricalImportResult> {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - HISTORICAL_IMPORT_DAYS * 24 * 60 * 60 * 1000);
  let recordCount = 0;
  const failedTypes: TrackedRecordType[] = [];

  for (const recordType of TRACKED_RECORD_TYPES) {
    try {
      const { records } = await readRecordsForType(recordType, {
        timeRangeFilter: {
          operator: "between",
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      });

      if (records.length === 0) continue;

      const normalized = records
        .map((r) => normalizeRecord(r as HealthConnectRecordResult))
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (normalized.length > 0) {
        const result = await syncChunked(normalized, [], null);
        recordCount += result.upserted;
        if (!result.success) failedTypes.push(recordType);
      }
    } catch {
      // One type's read or sync failure shouldn't stop the rest — every
      // syncBatch call is independent and idempotent, so records already
      // persisted for other types (before or after this one) are unaffected.
      failedTypes.push(recordType);
    }
  }

  return { recordCount, failedTypes };
}

// Seeds a changes-token cursor. Passing no changesToken makes the native layer
// call Health Connect's own getChangesToken() and immediately return an empty
// change-set against it (verified against the installed library's native
// source, not just its TS types) — so this is a real, current token, not a
// placeholder, safe to persist as the sync cursor going forward.
async function seedChangesToken(): Promise<string> {
  const result = await fetchChanges({ recordTypes: [...TRACKED_RECORD_TYPES] });
  return result.nextChangesToken;
}

interface IncrementalSyncResult {
  upserted: number;
  deleted: number;
  chunkFailed: boolean;
  failedRecordTypes: TrackedRecordType[];
}

async function runIncrementalSync(changesToken: string): Promise<IncrementalSyncResult> {
  let token = changesToken;
  let upserted = 0;
  let deleted = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchChanges({ changesToken: token, recordTypes: [...TRACKED_RECORD_TYPES] });

    if (result.changesTokenExpired) {
      // Health Connect tokens expire after ~30 days of inactivity. Fall back to
      // a fresh historical import + new token rather than erroring the sync —
      // this is the documented, expected recovery path, not an edge case.
      const { recordCount, failedTypes } = await runHistoricalImport();
      if (failedTypes.length === 0) {
        const freshToken = await seedChangesToken();
        await syncBatch({ records: [], deletedRecordIds: [], changesToken: freshToken });
      }
      // No cursor is persisted above when any type failed, same rule as the
      // top-level historical-import path — the next sync retries cleanly.
      return { upserted: upserted + recordCount, deleted, chunkFailed: failedTypes.length > 0, failedRecordTypes: failedTypes };
    }

    const normalized = result.upsertionChanges
      .map((c) => normalizeRecord(c.record))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const deletedIds = result.deletionChanges.map((c) => c.recordId);

    if (normalized.length > 0 || deletedIds.length > 0 || !result.hasMore) {
      // Only persist the cursor once we've reached the end of this page chain
      // AND every chunk of it was accepted, so a crash or chunk failure mid-
      // pagination re-processes from the last *confirmed* token instead of
      // silently skipping the remainder of a change set.
      const chunkResult = await syncChunked(
        normalized,
        deletedIds,
        result.hasMore ? null : result.nextChangesToken
      );
      upserted += chunkResult.upserted;
      deleted += chunkResult.deleted;

      if (!chunkResult.success) {
        return { upserted, deleted, chunkFailed: true, failedRecordTypes: [] };
      }
    }

    token = result.nextChangesToken;
    hasMore = result.hasMore;
  }

  return { upserted, deleted, chunkFailed: false, failedRecordTypes: [] };
}

export async function runSync(): Promise<SyncResult> {
  const state = await getSyncState();

  if (!state.changesToken) {
    const { recordCount, failedTypes } = await runHistoricalImport();
    // A cursor is only ever seeded when every type completed successfully —
    // seeding one after a partial failure would make the next sync treat the
    // failed type's backlog as already handled, silently losing it.
    if (failedTypes.length === 0) {
      const token = await seedChangesToken();
      await syncBatch({ records: [], deletedRecordIds: [], changesToken: token });
    }

    const status: SyncStatus =
      failedTypes.length === 0
        ? "success"
        : failedTypes.length === TRACKED_RECORD_TYPES.length
          ? "failed"
          : "partial";

    return {
      imported: recordCount,
      upserted: recordCount,
      deleted: 0,
      mode: "historical",
      status,
      failedRecordTypes: failedTypes,
    };
  }

  const { upserted, deleted, chunkFailed, failedRecordTypes } = await runIncrementalSync(state.changesToken);
  const status: SyncStatus = !chunkFailed ? "success" : upserted + deleted === 0 ? "failed" : "partial";

  return { imported: 0, upserted, deleted, mode: "incremental", status, failedRecordTypes };
}
