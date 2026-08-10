const slugify = (name) => name.trim().toLowerCase().replace(/\s+/g, "");

const MUSCLE_DEFINITIONS = [
  { name: "Chest", split: "Push", color: "#22c55e", bodyRegions: ["chest"], bodySide: "front" },
  { name: "Back", split: "Pull", color: "#3b82f6", bodyRegions: ["upperBack", "lowerBack"], bodySide: "back" },
  { name: "Shoulders", split: "Push", color: "#ef4444", bodyRegions: ["shoulderL", "shoulderR"], bodySide: "front" },
  { name: "Traps", split: "Pull", color: "#0ea5e9", bodyRegions: ["traps"], bodySide: "back" },
  { name: "Biceps", split: "Pull", color: "#a855f7", bodyRegions: ["bicepL", "bicepR"], bodySide: "front" },
  { name: "Triceps", split: "Push", color: "#f97316", bodyRegions: ["tricepL", "tricepR"], bodySide: "back" },
  { name: "Forearms", split: "Pull", color: "#14b8a6", bodyRegions: ["forearmL", "forearmR"], bodySide: "both" },
  { name: "Abs", split: "Core", color: "#f43f5e", bodyRegions: ["abs"], bodySide: "front" },
  { name: "Quads", split: "Legs", color: "#06b6d4", bodyRegions: ["quadL", "quadR"], bodySide: "front" },
  { name: "Hamstrings", split: "Legs", color: "#6366f1", bodyRegions: ["hamstringL", "hamstringR"], bodySide: "back" },
  { name: "Glutes", split: "Legs", color: "#ec4899", bodyRegions: ["glutes"], bodySide: "back" },
  { name: "Calves", split: "Legs", color: "#84cc16", bodyRegions: ["calfL", "calfR"], bodySide: "back" },
].map((def) => ({ ...def, id: slugify(def.name), legacyAliases: [] }));

const LEGACY_MUSCLE_DEFINITIONS = [
  {
    name: "Legs",
    split: "Legs",
    color: "#eab308",
    bodyRegions: ["quadL", "quadR", "calfL", "calfR"],
    bodySide: "both",
  },
].map((def) => ({ ...def, id: slugify(def.name), legacyAliases: [] }));

const ALL_MUSCLE_DEFINITIONS = [...MUSCLE_DEFINITIONS, ...LEGACY_MUSCLE_DEFINITIONS];

const byName = (defs) => Object.fromEntries(defs.map((d) => [d.name, d]));

export const MUSCLE_DEFINITIONS_BY_NAME = byName(ALL_MUSCLE_DEFINITIONS);

export const getMuscleDefinition = (name) => MUSCLE_DEFINITIONS_BY_NAME[name] || null;


export const MUSCLES = MUSCLE_DEFINITIONS.map((d) => d.name);

export const LEGACY_MUSCLES = LEGACY_MUSCLE_DEFINITIONS.map((d) => d.name);

export const ALL_ACCEPTED_MUSCLES = [...MUSCLES, ...LEGACY_MUSCLES];

export const isValidMuscle = (value) => ALL_ACCEPTED_MUSCLES.includes(value);

export const MUSCLE_SPLIT_CATEGORY = Object.fromEntries(
  ALL_MUSCLE_DEFINITIONS.map((d) => [d.name, d.split])
);

export const MUSCLE_DOT_COLORS = Object.fromEntries(
  ALL_MUSCLE_DEFINITIONS.map((d) => [d.name, d.color])
);

export const MUSCLE_TO_REGIONS = Object.fromEntries(
  ALL_MUSCLE_DEFINITIONS.map((d) => [d.name, d.bodyRegions])
);
