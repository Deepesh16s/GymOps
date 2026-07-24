// Single source of truth for muscle metadata on the frontend. Every
// per-muscle fact (order, split category, chart color, body-map
// region(s)/side) lives once, on one object, in MUSCLE_DEFINITIONS below
// — everything else in this file (MUSCLES, MUSCLE_SPLIT_CATEGORY,
// MUSCLE_DOT_COLORS, MUSCLE_TO_REGIONS, ...) is *derived* from it, not a
// separately maintained parallel map. Add a new muscle by adding one
// object here; every consumer (selectors, filters, charts, MuscleBodyMap)
// picks it up automatically.
//
// Mirrors server/constants/muscles.js — that side only needs the plain
// name lists (schema enum + request validation have no use for color/
// split/body-map data), so it isn't a definitions object there. If the
// accepted muscle *names* change, update both files.
//
// `name` (e.g. "Chest") is the canonical, persisted value — it's exactly
// what's stored in Exercise.muscleGroup / Workout documents today, and
// this refactor does not change that. `id` (e.g. "chest") is derived
// automatically for implementation details that want a lowercase token
// (CSS classes, keys) — never persisted, never sent over the API.
const slugify = (name) => name.trim().toLowerCase().replace(/\s+/g, "");

// Canonical, current taxonomy — this array's order is the order used
// everywhere a muscle list is rendered (selectors, filters, charts,
// summaries).
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

// Legacy values — never offered in a creation/edit form (excluded from
// MUSCLES) but still fully defined here so every derived map (colors,
// split, body-map regions) keeps working for exercises/workouts already
// tagged with them. "Legs" predates Quads/Glutes/Calves/Hamstrings
// existing as their own groups, so it covers the two regions from the
// original, coarser body-map split (quads + calves) rather than any one
// current muscle.
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

// ---------------------------------------------------------------------
// Everything below is derived from MUSCLE_DEFINITIONS /
// LEGACY_MUSCLE_DEFINITIONS above — existing consumers keep importing
// these exact names/shapes, so nothing outside this file needed to
// change as part of this refactor.
// ---------------------------------------------------------------------

export const MUSCLES = MUSCLE_DEFINITIONS.map((d) => d.name);

export const LEGACY_MUSCLES = LEGACY_MUSCLE_DEFINITIONS.map((d) => d.name);

export const ALL_ACCEPTED_MUSCLES = [...MUSCLES, ...LEGACY_MUSCLES];

export const isValidMuscle = (value) => ALL_ACCEPTED_MUSCLES.includes(value);

// Push/Pull/Legs/Core training-split categorization (the same standard
// split Guide.jsx already explains to users), applied to real logged
// set counts by MuscleBodyMap / progressionInsights / Analytics.
export const MUSCLE_SPLIT_CATEGORY = Object.fromEntries(
  ALL_MUSCLE_DEFINITIONS.map((d) => [d.name, d.split])
);

// Decorative, fixed per-muscle color so a reader can visually group a
// long list (e.g. Personal Records) by muscle at a glance — not tied
// to any design-token semantic, just a distinct hue per group. Falls
// back to a neutral dot for cardio/unclassified entries.
export const MUSCLE_DOT_COLORS = Object.fromEntries(
  ALL_MUSCLE_DEFINITIONS.map((d) => [d.name, d.color])
);

// Muscle -> Muscle Body Map SVG region id(s). Several muscle names can
// share a region (legacy "Legs" vs the newer "Quads"/"Calves" covering
// the same shapes) — MuscleBodyMap's own regionFill logic resolves that
// by picking whichever muscle actually has data for a shared region.
export const MUSCLE_TO_REGIONS = Object.fromEntries(
  ALL_MUSCLE_DEFINITIONS.map((d) => [d.name, d.bodyRegions])
);
