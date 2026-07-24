// Phase 13D, Part A.2 — Reminder Timeline: a purely presentational
// regrouping of ALREADY-FETCHED notifications (NotificationCenter's own
// `notifications` state) into chronological buckets. Does not call the
// reminder engine, does not fetch anything new, does not change what a
// notification IS — the exact same list the flat "List" view shows, just
// bucketed differently. Reuses `expiresAt` (already computed by every
// generator — see reminders/*.js) as the one real "which day is this
// about" signal already available; nothing here invents a date.
const MS_PER_DAY = 86400000;

function daysFromToday(date) {
  const today = new Date();
  const target = new Date(date);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / MS_PER_DAY);
}

const TIMELINE_GROUPS = ["Overdue", "Upcoming", "Tomorrow", "Later This Week", "Later"];

// A notification with no expiresAt has no specific day it's "about" (a
// goal-progress or achievement reminder is relevant continuously, not on
// one calendar day) — it lands in "Upcoming" alongside anything expiring
// today, matching how those two kinds of reminders read equally
// "current" to a user glancing at the list.
function groupFor(notification) {
  if (!notification.expiresAt) return "Upcoming";

  const diff = daysFromToday(notification.expiresAt);
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Upcoming";
  if (diff === 1) return "Tomorrow";
  if (diff <= 7) return "Later This Week";
  return "Later";
}

// Returns only the non-empty groups, in a fixed, sensible order
// (soonest-relevant first) — each group's items keep whatever order
// they arrived in (NotificationCenter already sorts by priority before
// calling this).
export function groupRemindersByTimeline(notifications) {
  const buckets = new Map(TIMELINE_GROUPS.map((label) => [label, []]));
  notifications.forEach((n) => {
    buckets.get(groupFor(n)).push(n);
  });

  return TIMELINE_GROUPS.map((label) => ({ label, items: buckets.get(label) })).filter(
    (group) => group.items.length > 0
  );
}
