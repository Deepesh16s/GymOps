// Standardized confidence tiering — reused by every intelligence engine
// so "High/Medium/Low confidence" always means the same thing everywhere
// instead of each engine inventing its own cutoffs. The 8/4 thresholds
// aren't new: they're the exact numbers progressionUtils.suggestNextTarget
// already used for the Progressive Overload Engine's own confidence
// (MIN_SESSIONS_FOR_HIGH_CONFIDENCE=8, MIN_SESSIONS_FOR_SUGGESTION=4) —
// this file just makes that convention explicit and shared rather than
// re-picked per engine.
const HIGH_THRESHOLD = 8;
const MEDIUM_THRESHOLD = 4;

export function getConfidenceLevel(sampleSize) {
  if (sampleSize >= HIGH_THRESHOLD) return "High";
  if (sampleSize >= MEDIUM_THRESHOLD) return "Medium";
  return "Low";
}

// `noun` is singular (e.g. "session", "workout", "week") — pluralized
// here so every engine's reason reads naturally without each one
// re-implementing the same plural check.
//
// `context.entity` (e.g. a muscle or exercise name) and `context.weeks`
// (real span from first-logged to now, when the caller has it) make the
// reason answer "why medium confidence" instead of just stating the
// tier — "Based on 8 logged Shoulder workouts over the last 6 weeks"
// instead of a bare "8 workouts analyzed". Both are optional: callers
// without a natural entity/week-span (whole-body reads like Fatigue or
// Weekly Grade) get the exact same generic phrasing as before.
export function getConfidenceReason(sampleSize, noun = "session", context = {}) {
  const { entity, weeks } = context;
  const plural = sampleSize === 1 ? "" : "s";
  const subject = entity ? `${entity} ${noun}${plural}` : `${noun}${plural}`;

  if (!sampleSize) return entity ? `No ${entity} ${noun}s logged yet` : `No ${noun}${plural} logged yet`;

  if (sampleSize < MEDIUM_THRESHOLD) {
    return entity ? `Limited history available for ${entity}` : `Only ${sampleSize} ${subject} available`;
  }

  if (weeks) {
    return `Based on ${sampleSize} logged ${subject} over the last ${weeks} week${weeks === 1 ? "" : "s"}`;
  }

  return sampleSize >= HIGH_THRESHOLD ? `${sampleSize} ${subject} analyzed` : `Only ${sampleSize} ${subject} available`;
}

// Convenience wrapper returning both parts together — most engines want
// both the level (for the badge) and the reason (for the "why" caption)
// from the same sample size in one call.
export function getConfidence(sampleSize, noun = "session", context = {}) {
  return { level: getConfidenceLevel(sampleSize), reason: getConfidenceReason(sampleSize, noun, context) };
}
