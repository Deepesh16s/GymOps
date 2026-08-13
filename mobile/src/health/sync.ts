import type { HealthConnectRecordResult } from "react-native-health-connect";
import { readRecordsForType, fetchChanges } from "./healthConnectClient";
import { normalizeRecord } from "./normalize";
import { TRACKED_RECORD_TYPES } from "./recordTypes";
import { getSyncState, syncBatch } from "../api/health";

const HISTORICAL_IMPORT_DAYS = 30; // Health Connect's default read window without
// the extra PERMISSION_READ_HEALTH_DATA_HISTORY grant, which this app does not
// request in Phase 2 (least privilege — add only if a deeper backfill becomes
// a real product need).

export interface SyncResult {
  imported: number;
  upserted: number;
  deleted: number;
  mode: "historical" | "incremental";
}

async function runHistoricalImport(): Promise<{ recordCount: number }> {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - HISTORICAL_IMPORT_DAYS * 24 * 60 * 60 * 1000);
  let recordCount = 0;

  for (const recordType of TRACKED_RECORD_TYPES) {
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
      await syncBatch({ records: normalized, deletedRecordIds: [], changesToken: null });
      recordCount += normalized.length;
    }
  }

  return { recordCount };
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

async function runIncrementalSync(changesToken: string): Promise<{ upserted: number; deleted: number }> {
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
      const { recordCount } = await runHistoricalImport();
      const freshToken = await seedChangesToken();
      await syncBatch({ records: [], deletedRecordIds: [], changesToken: freshToken });
      return { upserted: upserted + recordCount, deleted };
    }

    const normalized = result.upsertionChanges
      .map((c) => normalizeRecord(c.record))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const deletedIds = result.deletionChanges.map((c) => c.recordId);

    if (normalized.length > 0 || deletedIds.length > 0 || !result.hasMore) {
      await syncBatch({
        records: normalized,
        deletedRecordIds: deletedIds,
        // Only persist the cursor once we've reached the end of this page chain,
        // so a crash mid-pagination re-processes from the last *confirmed* token
        // instead of silently skipping the remainder of a change set.
        changesToken: result.hasMore ? null : result.nextChangesToken,
      });
    }

    upserted += normalized.length;
    deleted += deletedIds.length;
    token = result.nextChangesToken;
    hasMore = result.hasMore;
  }

  return { upserted, deleted };
}

export async function runSync(): Promise<SyncResult> {
  const state = await getSyncState();

  if (!state.changesToken) {
    const { recordCount } = await runHistoricalImport();
    const token = await seedChangesToken();
    await syncBatch({ records: [], deletedRecordIds: [], changesToken: token });
    return { imported: recordCount, upserted: recordCount, deleted: 0, mode: "historical" };
  }

  const { upserted, deleted } = await runIncrementalSync(state.changesToken);
  return { imported: 0, upserted, deleted, mode: "incremental" };
}
