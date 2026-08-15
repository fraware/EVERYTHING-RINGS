import type {
  AcousticFingerprintAlgorithmVersion,
} from "@everything-rings/dsp";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_GATE_A_THRESHOLDS,
  deriveEvidenceRecurrence,
  deriveMedianModalDriftCents,
  evaluateGateARelease,
  evaluateGateASession,
  parseValidationEvidence,
  type ValidationEvidenceV5,
} from "../src";
import { evidence } from "./helpers";

function withAlgorithmVersion(
  bundle: ValidationEvidenceV5,
  algorithmVersion: AcousticFingerprintAlgorithmVersion,
): ValidationEvidenceV5 {
  const attempts = bundle.attempts.map((attempt) => attempt.analysis.status === "success"
    ? {
        ...attempt,
        analysis: {
          status: "success" as const,
          fingerprint: { ...attempt.analysis.fingerprint, algorithmVersion },
        },
      }
    : attempt);
  return {
    ...bundle,
    attempts,
    recurrence: deriveEvidenceRecurrence(attempts),
    medianModalDriftCents: deriveMedianModalDriftCents(attempts),
  };
}

describe("fingerprint algorithm provenance", () => {
  it("accepts current er-dsp-2 evidence", () => {
    const bundle = evidence("current", "metal");
    expect(parseValidationEvidence(bundle).ok).toBe(true);
    expect(evaluateGateASession(bundle).passed).toBe(true);
  });

  it("keeps historical er-dsp-1 evidence interpretable", () => {
    const bundle = withAlgorithmVersion(evidence("legacy", "metal"), "er-dsp-1");
    expect(parseValidationEvidence(bundle).ok).toBe(true);
    expect(evaluateGateASession(bundle).passed).toBe(true);
  });

  it("rejects unknown algorithm identifiers", () => {
    const bundle = evidence("unknown", "metal");
    const attempts = bundle.attempts.map((attempt) => attempt.analysis.status === "success"
      ? {
          ...attempt,
          analysis: {
            status: "success" as const,
            fingerprint: { ...attempt.analysis.fingerprint, algorithmVersion: "er-dsp-3" },
          },
        }
      : attempt);
    const parsed = parseValidationEvidence({ ...bundle, attempts });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain("qualified attempts");
  });

  it("rejects one session that mixes fingerprint algorithms", () => {
    const bundle = evidence("mixed-session", "metal");
    const attempts = bundle.attempts.map((attempt, index) => (
      index === 2 && attempt.analysis.status === "success"
        ? {
            ...attempt,
            analysis: {
              status: "success" as const,
              fingerprint: { ...attempt.analysis.fingerprint, algorithmVersion: "er-dsp-1" as const },
            },
          }
        : attempt
    ));
    const mixed = {
      ...bundle,
      attempts,
      recurrence: deriveEvidenceRecurrence(attempts),
      medianModalDriftCents: deriveMedianModalDriftCents(attempts),
    };
    const parsed = parseValidationEvidence(mixed);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain("one fingerprint algorithm version");
    const verdict = evaluateGateASession(mixed as ValidationEvidenceV5);
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.some((reason) => reason.includes("one fingerprint algorithm version"))).toBe(true);
  });

  it("rejects a release that mixes historical and current algorithms under one software revision", () => {
    const current = evidence("current-release", "metal", { specimenId: "current-release" });
    const legacy = withAlgorithmVersion(
      evidence("legacy-release", "glass", { specimenId: "legacy-release" }),
      "er-dsp-1",
    );
    const verdict = evaluateGateARelease([current, legacy], {
      ...DEFAULT_GATE_A_THRESHOLDS,
      minimumDistinctSpecimens: 2,
      requiredMaterials: ["metal", "glass"],
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.some((reason) => reason.includes("one fingerprint algorithm version"))).toBe(true);
  });
});
