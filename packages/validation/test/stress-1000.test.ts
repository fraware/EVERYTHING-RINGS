import { describe, expect, it } from "vitest";
import {
  evaluateGateARelease,
  evaluateGateASession,
  mergeValidationEvidence,
  parseValidationEvidence,
  parseValidationEvidenceJson,
} from "../src";
import { SOFTWARE_REVISION, evidence, fiveObjects } from "./helpers";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 0x100000000;
  };
}

describe("1,000-case validation stress", () => {
  it("round-trips valid evidence, preserves self-merge, and rejects malformed revisions", () => {
    for (let seed = 0; seed < 1000; seed += 1) {
      const random = rng(seed ^ 0xe71d);
      const comparisonCents = Array.from({ length: 4 }, () => random() * 20);
      const bundle = evidence(`stress-${seed}`, "metal", {
        specimenId: `specimen-${seed}`,
        sessionId: `session-${seed}`,
        comparisonCents,
      });
      const parsed = parseValidationEvidenceJson(JSON.stringify(bundle));
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      expect(evaluateGateASession(parsed.evidence).passed).toBe(true);
      const merged = mergeValidationEvidence(bundle, parsed.evidence);
      expect(merged.ok).toBe(true);
      const malformed = seed % 2 === 0
        ? SOFTWARE_REVISION.slice(0, 39)
        : SOFTWARE_REVISION.toUpperCase();
      expect(parseValidationEvidence({ ...bundle, softwareRevision: malformed }).ok).toBe(false);
    }
  });

  it("rejects mixed valid software revisions across release evidence", () => {
    const alternateRevision = "fedcba9876543210fedcba9876543210fedcba98";
    for (let seed = 0; seed < 1000; seed += 1) {
      const bundles = fiveObjects().map((bundle, index) => index === seed % 5
        ? { ...bundle, softwareRevision: alternateRevision }
        : bundle);
      const verdict = evaluateGateARelease(bundles);
      expect(verdict.passed).toBe(false);
      expect(verdict.softwareRevision).toBeNull();
      expect(verdict.reasons).toContain("release evidence must use one software revision");
    }
  });
});
