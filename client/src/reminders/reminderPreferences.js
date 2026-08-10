import { REMINDER_PREFERENCE_CATEGORIES } from "../constants/notificationTypes";

const STORAGE_KEY = "repvyn:reminderPreferences";

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
