import type { HealthConnectRecordResult } from "react-native-health-connect";
import type { TrackedRecordType } from "./recordTypes";

export interface NormalizedSample {
  recordType: Exclude<TrackedRecordType, "SleepSession">;
  healthConnectRecordId: string;
  startTime: string;
  endTime: string;
  value: unknown;
  unit: string | null;
  sourceOrigin: string | null;
  device: { manufacturer?: string; model?: string } | null;
}

export interface NormalizedSleepSession {
  recordType: "SleepSession";
  healthConnectRecordId: string;
  startTime: string;
  endTime: string;
  stages: Array<{ startTime: string; endTime: string; stage: number }>;
  title: string | null;
  sourceOrigin: string | null;
  device: { manufacturer?: string; model?: string } | null;
}

export type NormalizedRecord = NormalizedSample | NormalizedSleepSession;

// Health Connect assigns every record a stable UUID (metadata.id) regardless of
// how many times it's synced — this is the idempotency key the backend upserts
// on, not a client-generated id, so re-syncing the same record is always a no-op.
function requireRecordId(record: HealthConnectRecordResult): string {
  const id = record.metadata?.id;
  if (!id) throw new Error(`Health Connect record missing metadata.id (${record.recordType})`);
  return id;
}

function device(record: HealthConnectRecordResult) {
  const d = record.metadata?.device;
  if (!d) return null;
  return { manufacturer: d.manufacturer, model: d.model };
}

export function normalizeRecord(record: HealthConnectRecordResult): NormalizedRecord | null {
  const sourceOrigin = record.metadata?.dataOrigin ?? null;
  const dev = device(record);
  const healthConnectRecordId = requireRecordId(record);

  switch (record.recordType) {
    case "HeartRate":
      return {
        recordType: "HeartRate",
        healthConnectRecordId,
        startTime: record.startTime,
        endTime: record.endTime,
        value: record.samples.map((s) => ({ time: s.time, beatsPerMinute: s.beatsPerMinute })),
        unit: "bpm",
        sourceOrigin,
        device: dev,
      };
    case "RestingHeartRate":
      return {
        recordType: "RestingHeartRate",
        healthConnectRecordId,
        startTime: record.time,
        endTime: record.time,
        value: record.beatsPerMinute,
        unit: "bpm",
        sourceOrigin,
        device: dev,
      };
    case "HeartRateVariabilityRmssd":
      return {
        recordType: "HeartRateVariabilityRmssd",
        healthConnectRecordId,
        startTime: record.time,
        endTime: record.time,
        value: record.heartRateVariabilityMillis,
        unit: "ms",
        sourceOrigin,
        device: dev,
      };
    case "Steps":
      return {
        recordType: "Steps",
        healthConnectRecordId,
        startTime: record.startTime,
        endTime: record.endTime,
        value: record.count,
        unit: "count",
        sourceOrigin,
        device: dev,
      };
    case "ActiveCaloriesBurned":
      // Read results replace the write-side {value, unit} shape with an
      // all-units-computed EnergyResult (confirmed against the installed
      // library's result types, not assumed) — kilocalories is picked as the
      // one canonical unit to store rather than keeping all four redundantly.
      return {
        recordType: "ActiveCaloriesBurned",
        healthConnectRecordId,
        startTime: record.startTime,
        endTime: record.endTime,
        value: record.energy.inKilocalories,
        unit: "kilocalories",
        sourceOrigin,
        device: dev,
      };
    case "ExerciseSession":
      return {
        recordType: "ExerciseSession",
        healthConnectRecordId,
        startTime: record.startTime,
        endTime: record.endTime,
        value: { exerciseType: record.exerciseType, title: record.title ?? null },
        unit: null,
        sourceOrigin,
        device: dev,
      };
    case "SleepSession":
      return {
        recordType: "SleepSession",
        healthConnectRecordId,
        startTime: record.startTime,
        endTime: record.endTime,
        stages: (record.stages ?? []).map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          stage: s.stage,
        })),
        title: record.title ?? null,
        sourceOrigin,
        device: dev,
      };
    default:
      // A record type outside our tracked set slipped through (shouldn't happen
      // given we only ever request/read the 7 tracked types) — skip rather than
      // throw, so one unexpected record can't abort an entire sync batch.
      return null;
  }
}
