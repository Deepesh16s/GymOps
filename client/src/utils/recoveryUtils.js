// Phase 14A — per-muscle recovery-time math shared by Module 1 (Recovery
// Score) and Module 2 (Readiness Score, which aggregates recovery scores
// across muscles). Pure math only: callers assemble the real inputs from
// workoutUtils.computeMuscleBreakdown + raw session data; nothing here
// fetches or re-derives what a muscle, a set, or a session is.
import { clampScore } from "./scoringUtils";

// Baseline hours a muscle needs to recover from a routine, moderate
// session — matches the 2-day (48h) convention already established by
// reminders/recoveryReminders.js's RECOVERY_WINDOW_DAYS (`=== 2` days),
// so this module doesn't introduce a second, conflicting definition of
// "recovered". Every multiplier below stretches or compresses this ONE
// baseline rather than each factor defining its own notion of recovery
// time.
export const BASELINE_RECOVERY_HOURS = 48;

// Reference points and caps — all centered on "a typical, moderate
// session leaves the baseline roughly untouched" (multiplier ~1.0), with
// a capped maximum stretch per factor so no single extreme input (a
// single huge session) can blow the estimate up unrealistically. These
// are disclosed, reasonable defaults, not scientific constants — see
// this module's role in a "not exact scientific values, adaptive
// estimate" system the same way Module 8's volume landmarks are.
const VOLUME_REFERENCE = 3000; // kg, a "hard session" volume ballpark
const MAX_VOLUME_MULTIPLIER = 1.5;
const INTENSITY_REFERENCE = 80; // %1RM baseline
const MAX_INTENSITY_MULTIPLIER = 1.4;
const OVERLAP_MULTIPLIER_PER_MUSCLE = 0.15;
const MAX_OVERLAP_MULTIPLIER = 1.6;
const CONSECUTIVE_DAY_MULTIPLIER_PER_DAY = 0.1;
const MAX_CONSECUTIVE_DAY_MULTIPLIER = 1.5;
const MAX_CARDIO_FATIGUE_MULTIPLIER = 1.2;

// Inputs mirror the phase spec's list for Module 1 exactly: last trained
// (handled by the caller, converted to hoursSinceTrained before scoring
// — see computeRecoveryScore below), total volume, intensity, frequency
// (folded into consecutiveTrainingDays — see recoveryEngine.js),
// overlapping muscles, session duration (folded into volume — a longer
// session at the same intensity already shows up as higher volume),
// cardio fatigue, consecutive training days.
export function computeRecoveryWindowHours({
  volume = 0,
  avgIntensity = null,
  overlappingMusclesTrainedRecently = 0,
  consecutiveTrainingDays = 0,
  cardioFatigueRatio = 0,
} = {}) {
  let hours = BASELINE_RECOVERY_HOURS;

  hours *= 1 + Math.min(MAX_VOLUME_MULTIPLIER - 1, (volume / VOLUME_REFERENCE) * 0.5);

  if (avgIntensity != null) {
    hours *=
      1 +
      Math.max(0, Math.min(MAX_INTENSITY_MULTIPLIER - 1, (avgIntensity - INTENSITY_REFERENCE) / 100));
  }

  hours *= Math.min(
    MAX_OVERLAP_MULTIPLIER,
    1 + overlappingMusclesTrainedRecently * OVERLAP_MULTIPLIER_PER_MUSCLE
  );
  hours *= Math.min(
    MAX_CONSECUTIVE_DAY_MULTIPLIER,
    1 + consecutiveTrainingDays * CONSECUTIVE_DAY_MULTIPLIER_PER_DAY
  );
  hours *= Math.min(MAX_CARDIO_FATIGUE_MULTIPLIER, 1 + cardioFatigueRatio * 0.2);

  return Math.round(hours);
}

// Turns "hours since last trained" + "hours needed to recover" into a
// 0-100 score — a plain linear ramp (not exponential decay) so
// `hoursUntilRecovered` (the literal countdown the phase spec asks for)
// stays a trivial, predictable subtraction rather than needing to invert
// a curve. 100 once the window has fully elapsed; never trained at all
// scores 100 (nothing to recover from).
export function computeRecoveryScore(hoursSinceTrained, recoveryWindowHours) {
  if (hoursSinceTrained == null) return 100;
  if (hoursSinceTrained >= recoveryWindowHours) return 100;
  const hoursRemaining = recoveryWindowHours - hoursSinceTrained;
  return clampScore(100 * (1 - hoursRemaining / recoveryWindowHours));
}

export function hoursUntilRecovered(hoursSinceTrained, recoveryWindowHours) {
  if (hoursSinceTrained == null) return 0;
  return Math.max(0, Math.round(recoveryWindowHours - hoursSinceTrained));
}

export function recoveryScoreToStatus(score) {
  if (score >= 85) return "Recovered";
  if (score >= 50) return "Recovering";
  return "Needs Rest";
}
