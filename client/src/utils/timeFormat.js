// Workout Session Editing & Time Tracking. Shared formatting so a
// duration/clock-time reads the same way everywhere it appears
// (Workout History, Calendar, the Edit Workout Timing modal) instead of
// each screen inventing its own "76 min" / "18:32" shorthand.

// "1h 16m" instead of "76 min" — minutes alone stop being easy to scan
// once a session runs past an hour. Sessions under an hour still just
// show "42m" rather than "0h 42m".
export function formatDurationLong(minutes) {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return "—";
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// 12-hour clock ("6:32 PM") by default — the 24-hour path is here as a
// parameter, not a separate function, since the only thing that differs
// is the Intl option, and callers that want to honor a future user
// preference can pass it straight through instead of picking between two
// exported functions.
export function formatClockTime(date, use24Hour = false) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(undefined, {
    hour: use24Hour ? "2-digit" : "numeric",
    minute: "2-digit",
    hour12: !use24Hour,
  });
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// "Just now" / "N min ago" / "N hour(s) ago" / "Yesterday" / a weekday
// name for the last ~week / "N days ago" beyond that / a short date
// beyond ~a month. The Dashboard's Recent Sessions feed originally owned
// the first four rungs (as a local, non-exported `timeAgo`); extended
// here so the Phase 13A notification panel — where items can realistically
// sit around for weeks — reads naturally at every age instead of just
// accumulating "47 days ago".
export function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return WEEKDAY_NAMES[date.getDay()];
  if (days < 30) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// <input type="datetime-local"> needs "YYYY-MM-DDTHH:mm" in LOCAL time —
// toISOString() would silently shift the value to UTC, showing the wrong
// clock time back to the user the moment the form re-renders.
export function toDateTimeLocalValue(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
