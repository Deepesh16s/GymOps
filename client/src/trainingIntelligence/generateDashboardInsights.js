import { getDashboardInsights } from "../utils/dashboardInsights";
import { getSmartInsights } from "../intelligence";

export function generateDashboardInsights(workouts) {
  const existing = getDashboardInsights(workouts);
  const smart = getSmartInsights(workouts);

  return {
    existing,
    smart,
    combined: [...existing.map((i) => `${i.title} — ${i.detail}`), ...smart],
  };
}
