import { describe, expect, it } from "vitest";
import {
  evaluateGateASession,
  mergeValidationEvidence,
  type GateBReview,
  type ValidationEvidenceV3,
} from "../src";
import { deriveEvidenceRecurrence, deriveMedianModalDriftCents } from "../src/derive";

function fingerprint(cents = 0) {
  const ratio = 2 ** (cents / 1200);
  return {
    version: 1 as const,
    algorithmVersion: "er-dsp-1" as const,
    sampleRate: 48000,
    durationSeconds: 2,
    modes: [440, 880, 1320].map((frequencyHz, index) => ({
      frequencyHz: frequencyHz * ratio,
      relativeAmplitude: 1 / (index + 1),
      decaySeconds: 0.4 / (index + 1),
      q: 100,
      confidence: 0.9,
      diagnostics: {
        prominenceDb: 20,
        persistenceSeconds: 0.2,
        frequencyStdCents: 2,
        decayFitScore: 0.95,
        observationCount: 12,
      },
    })),
  };
}

function bundle(): ValidationEvidenceV3 {
  const cents = [0, 5, 8, 10, 12];
  const records = cents.map((drift, index) => ({
    id: index + 1,
    quality: {
      score: 0.9,
      snrDb: 30,
      clippedFraction: 0,
      peakAmplitude: 0.4,
      secondaryTransientRatio: 0.1,
    },
    fingerprint: fingerprint(drift),
  }));
  return {
    schemaVersion: 3,
    evidenceContractVersion: "validation-evidence-3",
    gateAContractVersion: "gate-a-1",
    sessionId: "session-bell",
    createdAt: "2026-08-15T12:00:00.000Z",
    object: { label: "bell", material: "metal" },
    protocol: {
      fixedSetup: true,
      microphoneDistanceCm: 20,
      striker: "wooden dowel",
      strikeLocation: "rim mark",
      supportCondition: "held at base",
    },
    captureSettings: null,
    realtimeAudioTiming: null,
    recordCount: records.length,
    medianModalDriftCents: deriveMedianModalDriftCents(records),
    recurrence: deriveEvidenceRecurrence(records),
    records,
    gateBReviews: [],
    gateCReviews: [],
    rawMicrophoneSamplesIncluded: false,
  };
}

function review(reviewId: string, reviewerId: string): GateBReview {
  return {
    reviewId,
    reviewerId,
    objectLabel: "bell",
    sessionId: "session-bell",
    recordId: 5,
    blinded: true,
    presentationOrder: "original-model",
    identity: 4,
    brightness: 4,
    decayCharacter: 4,
    artifactSeverity: 2,
  };
}

describe("Gate A capture quality", () => {
  it("requires all five retained strikes to satisfy the frozen acquisition bounds", () => {
    const valid = bundle();
    expect(evaluateGateASession(valid).passed).toBe(true);

    const records = valid.records.map((record, index) => index === 2
      ? { ...record, quality: { ...record.quality, snrDb: 11.99 } }
      : record);
    const verdict = evaluateGateASession({ ...valid, records });
    expect(verdict.passed).toBe(false);
    expect(verdict.metrics.qualityPassingStrikes).toBe(4);
    expect(verdict.reasons.some((reason) => reason.includes("acquisition-quality"))).toBe(true);
  });

  it("accepts values exactly on the frozen quality boundaries", () => {
    const valid = bundle();
    const records = valid.records.map((record) => ({
      ...record,
      quality: {
        ...record.quality,
        peakAmplitude: 0.02,
        snrDb: 12,
        clippedFraction: 0.001,
        secondaryTransientRatio: 0.65,
      },
    }));
    expect(evaluateGateASession({ ...valid, records }).passed).toBe(true);
  });
});

describe("evidence session merging", () => {
  it("merges additional reviews only when the immutable measurement core matches", () => {
    const first = bundle();
    const second = {
      ...first,
      createdAt: "2026-08-15T12:05:00.000Z",
      gateBReviews: [review("review-1", "r1")],
    };
    const merged = mergeValidationEvidence(first, second);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.evidence.gateBReviews).toHaveLength(1);
    expect(merged.evidence.createdAt).toBe(second.createdAt);
  });

  it("rejects reuse of a session ID with different measurement evidence", () => {
    const first = bundle();
    const records = first.records.map((record, index) => index === 4
      ? { ...record, fingerprint: fingerprint(20) }
      : record);
    const second = { ...first, records };
    const merged = mergeValidationEvidence(first, second);
    expect(merged.ok).toBe(false);
    if (!merged.ok) expect(merged.error).toContain("different measurement evidence");
  });

  it("rejects one review ID reused with conflicting contents", () => {
    const first = { ...bundle(), gateBReviews: [review("same", "r1")] };
    const second = {
      ...bundle(),
      gateBReviews: [{ ...review("same", "r1"), identity: 1 as const }],
    };
    const merged = mergeValidationEvidence(first, second);
    expect(merged.ok).toBe(false);
    if (!merged.ok) expect(merged.error).toContain("conflicting contents");
  });
});
