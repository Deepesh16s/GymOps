export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatDate(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function dateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMon);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function firstWeekdayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}