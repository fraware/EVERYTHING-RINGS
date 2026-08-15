import { describe, expect, it } from "vitest";
import { buildReleaseVerdict, evaluateGateARelease } from "../src";
import type { ValidationEvidenceV5 } from "../src";
import { fiveObjects } from "./helpers";

function withAlgorithm(
  bundle: ValidationEvidenceV5,
  algorithmVersion: "er-dsp-1" | "er-dsp-2",
): ValidationEvidenceV5 {
  return {
    ...bundle,
    attempts: bundle.attempts.map((attempt) => attempt.analysis.status === "success"
      ? {
          ...attempt,
          analysis: {
            ...attempt.analysis,
            fingerprint: { ...attempt.analysis.fingerprint, algorithmVersion },
          },
        }
      : attempt),
  };
}

describe("current release algorithm policy", () => {
  it("keeps historical er-dsp-1 evidence evaluable through the explicit lower-level evaluator", () => {
    const historical = fiveObjects().map((bundle) => withAlgorithm(bundle, "er-dsp-1"));
    expect(evaluateGateARelease(historical).passed).toBe(true);
  });

  it("does not let historical er-dsp-1 evidence satisfy the current release verdict", () => {
    const historical = fiveObjects().map((bundle) => withAlgorithm(bundle, "er-dsp-1"));
    const verdict = buildReleaseVerdict(historical, [], [], "2026-08-15T18:00:00.000Z");

    expect(verdict.gateA.passed).toBe(false);
    expect(verdict.gateA.passingSessionCount).toBe(0);
    expect(verdict.gateA.distinctPassingSpecimenCount).toBe(0);
    expect(verdict.gateA.sessions.every((session) => session.passed === false)).toBe(true);
    expect(verdict.gateA.sessions.every((session) => session.reviewAttemptId === null)).toBe(true);
    expect(verdict.gateA.reasons).toContain("current release evidence must use fingerprint algorithm er-dsp-2");
    expect(verdict.releaseReady).toBe(false);
  });

  it("keeps canonical er-dsp-2 Gate A evidence eligible for the current release cycle", () => {
    const verdict = buildReleaseVerdict(fiveObjects(), [], [], "2026-08-15T18:00:00.000Z");
    expect(verdict.gateA.passed).toBe(true);
    expect(verdict.gateA.passingSessionCount).toBe(5);
    expect(verdict.gateA.distinctPassingSpecimenCount).toBe(5);
    expect(verdict.releaseReady).toBe(false);
  });
});
