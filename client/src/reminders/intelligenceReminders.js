// Phase 14B, section 8 — Intelligence-driven reminders. Every trigger
// below reuses a Phase 14A engine's ALREADY-COMPUTED output — nothing
// here re-derives plateau detection, weekly grading, recovery scoring,
// or volume-landmark math. This file only decides WHEN one of those
// outputs is worth surfacing as a reminder and assembles the candidate
// object reminderEngine.js's `raw` array expects (same schema every
// sibling generator in this folder returns).
import { getMusclePlateaus } from "../intelligence/plateauEngine";
import { getWeeklyGrade } from "../intelligence/weeklyGradeEngine";
import { getMuscleRecoveryScores } from "../intelligence/recoveryEngine";
import { getAllVolumeLandmarks } from "../intelligence/volumeLandmarkEngine";
import { getAvailableMuscles } from "../progression/progressionFilters";
import { getMuscleProgression } from "../progression/progressionEngine";

const MS_PER_DAY = 86400000;

// A grade improvement worth calling out, not noise from the composite
// score's own rounding. getWeeklyGrade's "last week" read here is a
// good-faith re-run of the SAME function anchored 7 days earlier — 3 of
// its 4 factors (consistency/balance/PR frequency) correctly re-window
// to that earlier week; the 4th (Progressive Overload, sourced from
// buildProgressionSeries' real-calendar-week buckets) still reflects the
// actual current week regardless of the anchor. Disclosed approximation,
// not a byte-perfect historical replay — same "adaptive estimate, not
// exact science" spirit Module 8's volume landmarks already carry.
const GRADE_IMPROVEMENT_THRESHOLD = 5;

function plateauReminders(workouts) {
  const muscles = getAvailableMuscles(workouts);
  const confirmed = getMusclePlateaus(workouts, muscles).filter((p) => p.plateauLevel === "Confirmed");
  if (!confirmed.length) return [];

  const muscleNames = confirmed.map((p) => p.muscle).sort();
  return [
    {
      type: "plateauDetected",
      category: "insights",
      confidence: "medium",
      icon: "AlertTriangle",
      title: confirmed.length === 1 ? "Plateau Detected" : "Plateaus Detected",
      subtitle:
        confirmed.length === 1
          ? `${muscleNames[0]} volume has stalled — consider progressive overload.`
          : `${confirmed.length} muscle groups have stalled — consider a deload or program change.`,
      navigationTarget: "/analytics",
      action: { page: "/analytics", entityId: null, focus: null },
      dedupeKey: `plateau-detected-${muscleNames.join("-").toLowerCase()}`,
      expiresAt: null,
      metadata: { muscles: muscleNames },
    },
  ];
}

function weeklyGradeReminders(workouts) {
  const thisWeek = getWeeklyGrade(workouts);
  const lastWeek = getWeeklyGrade(workouts, { now: new Date(Date.now() - 7 * MS_PER_DAY) });
  if (thisWeek.score == null || lastWeek.score == null) return [];
  if (thisWeek.score - lastWeek.score < GRADE_IMPROVEMENT_THRESHOLD) return [];

  return [
    {
      type: "weeklyGradeImproved",
      category: "insights",
      confidence: "high",
      icon: "Trophy",
      title: "Weekly Grade Improved",
      subtitle: `Up to ${thisWeek.grade} from ${lastWeek.grade} last week`,
      navigationTarget: "/analytics",
      action: { page: "/analytics", entityId: null, focus: null },
      // Stable, no week suffix — matches achievementReminders.js's
      // weeklyVolumeIncreased convention: next week's genuinely different
      // grade is itself a content change that bypasses the cooldown.
      dedupeKey: "weekly-grade-improved",
      expiresAt: null,
      metadata: { thisWeekGrade: thisWeek.grade, lastWeekGrade: lastWeek.grade },
    },
  ];
}

// A muscle that has just crossed INTO "Recovered" status but hasn't yet
// hit the full 100 score (hoursUntilRecovered > 0) is, by construction,
// a recent transition — recoveryScoreToStatus flips to "Recovered" only
// once the score clears 85, so this window is real and derivable from a
// single snapshot, no persisted history needed. Distinct from the
// existing recoveryComplete reminder (recoveryReminders.js's fixed
// 2-day heuristic) — this one reads the actual Module 1 recovery score.
function recoveryScoreReminders(workouts) {
  const scores = getMuscleRecoveryScores(workouts);
  const justRecovered = scores.filter((r) => r.status === "Recovered" && r.hoursUntilRecovered > 0);
  if (!justRecovered.length) return [];

  const muscleNames = justRecovered.map((r) => r.muscle).sort();
  return [
    {
      type: "recoveryScoreIncreased",
      category: "insights",
      confidence: "medium",
      icon: "HeartPulse",
      title: justRecovered.length === 1 ? "Recovery Improving" : "Recovery Improving",
      subtitle:
        justRecovered.length === 1
          ? `${muscleNames[0]} recovery score is climbing — ready to train again.`
          : `${justRecovered.length} muscle groups are recovering well.`,
      navigationTarget: "/dashboard",
      action: { page: "/dashboard", entityId: null, focus: null },
      dedupeKey: `recovery-score-increased-${muscleNames.join("-").toLowerCase()}`,
      expiresAt: new Date(Date.now() + 2 * MS_PER_DAY),
      metadata: { muscles: muscleNames },
    },
  ];
}

// "Achieved" reads as this week's logged volume for a muscle reaching its
// own MAV landmark (Module 8's percentile-based estimate) — a real,
// currently-true comparison, not a "just crossed" detection.
function volumeLandmarkReminders(workouts) {
  const muscles = getAvailableMuscles(workouts);
  const landmarks = getAllVolumeLandmarks(workouts, muscles).filter((l) => l.available);

  const achieved = landmarks.filter((l) => {
    const progression = getMuscleProgressionThisWeekVolume(workouts, l.muscle);
    return progression != null && progression >= l.mav;
  });
  if (!achieved.length) return [];

  const muscleNames = achieved.map((l) => l.muscle).sort();
  return [
    {
      type: "volumeLandmarkAchieved",
      category: "insights",
      confidence: "medium",
      icon: "Layers",
      title: "Volume Landmark Achieved",
      subtitle:
        achieved.length === 1
          ? `${muscleNames[0]} hit its MAV volume this week.`
          : `${achieved.length} muscle groups hit their MAV volume this week.`,
      navigationTarget: "/analytics",
      action: { page: "/analytics", entityId: null, focus: null },
      // Stable per muscle-set, no date suffix — same "content change
      // bypasses the cooldown" convention as weeklyGradeImproved above,
      // so this doesn't re-fire every single day while still true.
      dedupeKey: `volume-landmark-${muscleNames.join("-").toLowerCase()}`,
      expiresAt: null,
      metadata: { muscles: muscleNames },
    },
  ];
}

// Reuses progression/progressionEngine.js's getMuscleProgression series —
// same weekly-bucketed volume the volume landmarks themselves are built
// from — reading only the latest trained bucket's volume, never a second
// computation of what a "trained week" means.
function getMuscleProgressionThisWeekVolume(workouts, muscle) {
  const progression = getMuscleProgression(workouts, muscle);
  const trained = progression.series.filter((p) => p.hasData);
  if (!trained.length) return null;
  return trained[trained.length - 1].volume;
}

export function generateIntelligenceReminders(workouts) {
  return [
    ...plateauReminders(workouts),
    ...weeklyGradeReminders(workouts),
    ...recoveryScoreReminders(workouts),
    ...volumeLandmarkReminders(workouts),
  ];
}
