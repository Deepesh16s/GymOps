const HIGH_THRESHOLD = 8;
const MEDIUM_THRESHOLD = 4;

export function getConfidenceLevel(sampleSize) {
  if (sampleSize >= HIGH_THRESHOLD) return "High";
  if (sampleSize >= MEDIUM_THRESHOLD) return "Medium";
  return "Low";
}

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

export function getConfidence(sampleSize, noun = "session", context = {}) {
  return { level: getConfidenceLevel(sampleSize), reason: getConfidenceReason(sampleSize, noun, context) };
}
