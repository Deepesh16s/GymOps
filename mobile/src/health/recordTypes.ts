import type { Permission, RecordType } from "react-native-health-connect";

// Phase 2 prioritized set, per the approved rollout order: prove the
// watch -> Health Connect -> Repvyn -> database pipeline works end-to-end
// on a small, high-value slice before expanding to the rest of the ~50
// Health Connect record types. Read-only: this app never writes back to
// Health Connect, so only 'read' permissions are requested (least privilege).
export const TRACKED_RECORD_TYPES = [
  "HeartRate",
  "RestingHeartRate",
  "HeartRateVariabilityRmssd",
  "Steps",
  "ActiveCaloriesBurned",
  "SleepSession",
  "ExerciseSession",
] as const satisfies readonly RecordType[];

export type TrackedRecordType = (typeof TRACKED_RECORD_TYPES)[number];

export const READ_PERMISSIONS: Permission[] = TRACKED_RECORD_TYPES.map((recordType) => ({
  accessType: "read",
  recordType,
}));

// Human-readable labels for the permission-rationale screen and connection status UI.
export const RECORD_TYPE_LABELS: Record<TrackedRecordType, string> = {
  HeartRate: "Heart rate",
  RestingHeartRate: "Resting heart rate",
  HeartRateVariabilityRmssd: "Heart rate variability",
  Steps: "Steps",
  ActiveCaloriesBurned: "Active calories",
  SleepSession: "Sleep",
  ExerciseSession: "Exercise sessions",
};
