import { describe, it, expect } from "vitest";
import {
  getMuscleEvidenceTier,
  withMuscleEvidenceQualifier,
  MUSCLE_EVIDENCE_TIERS,
} from "../../src/constants/evidenceSources";
import { MUSCLES } from "../../src/constants/muscles";

describe("muscle evidence tiers", () => {
  it("assigns every tracked muscle a tier — none silently fall through to a default without being deliberately classified", () => {
    // INSUFFICIENT is the safe fallback, but every muscle in the app's own
    // constant list should be an explicit entry in the tier map, not relying on it.
    MUSCLES.forEach((muscle) => {
      expect(Object.values(MUSCLE_EVIDENCE_TIERS)).toContain(getMuscleEvidenceTier(muscle));
    });
  });

  it("classifies muscles with direct dose-response evidence as DIRECT", () => {
    expect(getMuscleEvidenceTier("Quads")).toBe(MUSCLE_EVIDENCE_TIERS.DIRECT);
    expect(getMuscleEvidenceTier("Biceps")).toBe(MUSCLE_EVIDENCE_TIERS.DIRECT);
    expect(getMuscleEvidenceTier("Chest")).toBe(MUSCLE_EVIDENCE_TIERS.DIRECT);
  });

  it("classifies muscles with no meaningful dose-response evidence as INSUFFICIENT", () => {
    expect(getMuscleEvidenceTier("Traps")).toBe(MUSCLE_EVIDENCE_TIERS.INSUFFICIENT);
    expect(getMuscleEvidenceTier("Forearms")).toBe(MUSCLE_EVIDENCE_TIERS.INSUFFICIENT);
    expect(getMuscleEvidenceTier("Abs")).toBe(MUSCLE_EVIDENCE_TIERS.INSUFFICIENT);
  });

  it("does not append a qualifier for a DIRECT-tier muscle", () => {
    const base = "Base disclaimer.";
    expect(withMuscleEvidenceQualifier(base, "Quads")).toBe(base);
  });

  it("appends an explicit limited-evidence qualifier for an INSUFFICIENT-tier muscle", () => {
    const base = "Base disclaimer.";
    const qualified = withMuscleEvidenceQualifier(base, "Traps");
    expect(qualified).toContain(base);
    expect(qualified).toMatch(/evidence is limited for this specific muscle/i);
  });

  it("falls back to INSUFFICIENT (not a silent DIRECT default) for an unrecognized muscle name", () => {
    expect(getMuscleEvidenceTier("NotARealMuscle")).toBe(MUSCLE_EVIDENCE_TIERS.INSUFFICIENT);
  });
});
