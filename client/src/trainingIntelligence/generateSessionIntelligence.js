import { computeMuscleBreakdown, getWorkoutVolume, isCardioEntry } from "../utils/workoutUtils";

const MS_PER_DAY = 86400000;

export function generateSessionIntelligence(workouts, session) {
  const muscles = session.stats?.muscles || [];
  if (!muscles.length) {
    return { available: false, reason: "No strength muscles logged in this session." };
  }

  const sessionBreakdown = computeMuscleBreakdown(session.workouts).sort((a, b) => b.volume - a.volume);
  const highestFatigueContributor = sessionBreakdown[0] || null;

  const sessionDate = new Date(session.date);
  const weekStart = new Date(sessionDate);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart.getTime() + 7 * MS_PER_DAY);
  const weekVolume = workouts
    .filter((w) => !isCardioEntry(w))
    .filter((w) => {
      const t = new Date(w.date || w.createdAt);
      return t >= weekStart && t < weekEnd;
    })
    .reduce((s, w) => s + getWorkoutVolume(w), 0);
  const sessionVolume = session.stats?.volume || 0;
  const weeklyVolumeContributionPct = weekVolume > 0 ? Math.round((sessionVolume / weekVolume) * 100) : null;

  return {
    available: true,
    highestFatigueContributor: highestFatigueContributor
      ? { muscle: highestFatigueContributor.muscle, volume: Math.round(highestFatigueContributor.volume) }
      : null,
    weeklyVolumeContributionPct,
  };
}
