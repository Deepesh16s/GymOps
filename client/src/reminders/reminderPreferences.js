// Phase 13C, section 13 — per-category enable/disable, one toggle per
// REMINDER_PREFERENCE_CATEGORIES value. Stored in localStorage (same
// mechanism DarkModeToggle already uses for a per-browser UI preference)
// rather than a new backend model/endpoint — this is a small, low-risk
// UI setting, not data that needs to sync across devices or survive a
// logout, so a persisted server model would be more machinery than the
// feature is worth.
import { REMINDER_PREFERENCE_CATEGORIES } from "../constants/notificationTypes";

const STORAGE_KEY = "gymops:reminderPreferences";

const DEFAULT_PREFERENCES = Object.values(REMINDER_PREFERENCE_CATEGORIES).reduce(
  (acc, category) => ({ ...acc, [category]: true }),
  {}
);

export function getReminderPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return { ...DEFAULT_PREFERENCES, ...(stored || {}) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function setReminderPreference(category, enabled) {
  const current = getReminderPreferences();
  const next = { ...current, [category]: enabled };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function isReminderCategoryEnabled(category) {
  if (!category) return true;
  return getReminderPreferences()[category] !== false;
}
