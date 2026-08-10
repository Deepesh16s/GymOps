const MS_PER_DAY = 86400000;

function daysFromToday(date) {
  const today = new Date();
  const target = new Date(date);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / MS_PER_DAY);
}

const TIMELINE_GROUPS = ["Overdue", "Upcoming", "Tomorrow", "Later This Week", "Later"];

function groupFor(notification) {
  if (!notification.expiresAt) return "Upcoming";

  const diff = daysFromToday(notification.expiresAt);
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Upcoming";
  if (diff === 1) return "Tomorrow";
  if (diff <= 7) return "Later This Week";
  return "Later";
}

export function groupRemindersByTimeline(notifications) {
  const buckets = new Map(TIMELINE_GROUPS.map((label) => [label, []]));
  notifications.forEach((n) => {
    buckets.get(groupFor(n)).push(n);
  });

  return TIMELINE_GROUPS.map((label) => ({ label, items: buckets.get(label) })).filter(
    (group) => group.items.length > 0
  );
}
