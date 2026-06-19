/* Shared date helpers — used by Workout History, Analytics, and Calendar
   so date formatting and week/month math stays consistent everywhere
   instead of each page reinventing it. */

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/* "Jun 19, 2026" */
export function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* "2026-06-19" — stable key for grouping workouts by calendar day */
export function dateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/* Monday 00:00:00 of the week containing `date` (defaults to today) */
export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun .. 6 = Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMon);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* 1st of the month containing `date` (defaults to today) */
export function startOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* Number of days in a given (0-indexed) month */
export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/* Weekday (0 = Sun) the 1st of the month falls on — used to pad
   the calendar grid's leading empty cells */
export function firstWeekdayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}