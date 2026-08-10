import { getMusclePlateaus } from "../intelligence/plateauEngine";
import { getWeeklyGrade } from "../intelligence/weeklyGradeEngine";
import { getMuscleRecoveryScores } from "../intelligence/recoveryEngine";
import { getAllVolumeLandmarks } from "../intelligence/volumeLandmarkEngine";
import { getAvailableMuscles } from "../progression/progressionFilters";
import { getMuscleProgression } from "../progression/progressionEngine";

const MS_PER_DAY = 86400000;

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
      dedupeKey: "weekly-grade-improved",
      expiresAt: null,
      metadata: { thisWeekGrade: thisWeek.grade, lastWeekGrade: lastWeek.grade },
    },
  ];
}

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
      dedupeKey: `volume-landmark-${muscleNames.join("-").toLowerCase()}`,
      expiresAt: null,
      metadata: { muscles: muscleNames },
    },
  ];
}

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
