import { describe, expect, it } from "vitest";
import {
  buildReleaseVerdict,
  evaluateGateARelease,
  evaluateGateASession,
  evaluateGateBRelease,
  evaluateGateCRelease,
  parseValidationEvidence,
  type GateBReview,
  type GateCReview,
  type MaterialClass,
  type ValidationEvidenceV3,
} from "../src";

function fingerprint(offsetHz = 0) {
  return {
    version: 1 as const,
    algorithmVersion: "er-dsp-1" as const,
    sampleRate: 48000,
    durationSeconds: 2,
    modes: [440, 880, 1320].map((frequencyHz, index) => ({
      frequencyHz: frequencyHz + offsetHz,
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

function evidence(
  label: string,
  material: MaterialClass,
  options: { readonly comparisonMedians?: readonly number[]; readonly recordCount?: number; readonly sessionId?: string } = {},
): ValidationEvidenceV3 {
  const recordCount = options.recordCount ?? 5;
  const comparisonMedians = options.comparisonMedians ?? [5, 8, 10, 12];
  return {
    schemaVersion: 3,
    evidenceContractVersion: "validation-evidence-3",
    gateAContractVersion: "gate-a-1",
    sessionId: options.sessionId ?? `session-${label}`,
    createdAt: "2026-08-15T12:00:00.000Z",
    object: { label, material },
    protocol: {
      fixedSetup: true,
      microphoneDistanceCm: 20,
      striker: "wooden dowel",
      strikeLocation: "rim mark",
      supportCondition: "held at base",
    },
    captureSettings: null,
    realtimeAudioTiming: null,
    recordCount,
    medianModalDriftCents: 9,
    recurrence: comparisonMedians.map((medianCents, index) => ({
      recordId: index + 2,
      medianCents,
      meanCents: medianCents,
      matchedCount: 3,
      unmatchedReferenceCount: 0,
      matches: [],
    })),
    records: Array.from({ length: recordCount }, (_, index) => ({
      id: index + 1,
      quality: {
        score: 0.95,
        snrDb: 30,
        clippedFraction: 0,
        peakAmplitude: 0.5,
        secondaryTransientRatio: 0.05,
      },
      fingerprint: fingerprint(index * 0.1),
    })),
    gateBReviews: [],
    gateCReviews: [],
    rawMicrophoneSamplesIncluded: false,
  };
}

function fiveObjects(): ValidationEvidenceV3[] {
  return [
    evidence("bell", "metal"),
    evidence("wine glass", "glass"),
    evidence("metal bowl", "metal"),
    evidence("glass bottle", "glass"),
    evidence("ceramic mug", "ceramic"),
  ];
}

function gateBReview(objectLabel: string, reviewerId: string, overrides: Partial<GateBReview> = {}): GateBReview {
  return {
    reviewId: `${objectLabel}-${reviewerId}`,
    reviewerId,
    objectLabel,
    blinded: true,
    presentationOrder: "original-model",
    identity: 4,
    brightness: 4,
    decayCharacter: 4,
    artifactSeverity: 2,
    ...overrides,
  };
}

function gateCReview(objectLabel: string, deviceId: string, deviceClass: "desktop" | "mobile"): GateCReview {
  return {
    reviewId: `${objectLabel}-${deviceId}`,
    reviewerId: "listener-1",
    objectLabel,
    deviceId,
    deviceClass,
    identityAcrossRange: 4,
    timbreContinuity: 4,
    usefulSemitoneSpan: 12,
    latencyAcceptable: true,
  };
}

describe("Gate A", () => {
  it("passes a five-strike fixed-setup session inside the frozen drift bounds", () => {
    const verdict = evaluateGateASession(evidence("bell", "metal"));
    expect(verdict.passed).toBe(true);
    expect(verdict.metrics.acceptedStrikes).toBe(5);
    expect(verdict.metrics.sessionMedianDriftCents).toBe(9);
  });

  it("rejects optional stopping beyond the five accepted strikes", () => {
    const verdict = evaluateGateASession(evidence("bell", "metal", {
      recordCount: 6,
      comparisonMedians: [5, 8, 10, 12, 2],
    }));
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.some((reason) => reason.includes("exactly 5 accepted strikes"))).toBe(true);
    expect(verdict.reasons.some((reason) => reason.includes("exactly 4 recurrence comparisons"))).toBe(true);
  });

  it("rejects a recurrence tail above the frozen worst-comparison bound", () => {
    const verdict = evaluateGateASession(evidence("bell", "metal", { comparisonMedians: [4, 5, 6, 51] }));
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.some((reason) => reason.includes("worst comparison"))).toBe(true);
  });

  it("requires five distinct passing objects with metal, glass, and ceramic coverage", () => {
    expect(evaluateGateARelease(fiveObjects()).passed).toBe(true);
    const duplicate = [...fiveObjects().slice(0, 4), evidence("bell", "ceramic")];
    expect(evaluateGateARelease(duplicate).passed).toBe(false);
  });

  it("rejects conflicting material labels for the same physical object name", () => {
    const verdict = evaluateGateARelease([
      ...fiveObjects(),
      evidence("Bell", "ceramic", { sessionId: "session-bell-conflict" }),
    ]);
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.some((reason) => reason.includes("conflicting material labels"))).toBe(true);
  });
});

describe("Gate B", () => {
  it("requires two blinded reviewers and four passing objects", () => {
    const gateA = evaluateGateARelease(fiveObjects());
    const labels = fiveObjects().map((bundle) => bundle.object.label);
    const reviews = labels.flatMap((label) => [gateBReview(label, "r1"), gateBReview(label, "r2")]);
    expect(evaluateGateBRelease(gateA, reviews).passed).toBe(true);
    expect(evaluateGateBRelease(gateA, labels.map((label) => gateBReview(label, "r1"))).passed).toBe(false);
  });

  it("does not count an unblinded review toward the reviewer requirement", () => {
    const gateA = evaluateGateARelease(fiveObjects());
    const reviews = fiveObjects().flatMap((bundle) => [
      gateBReview(bundle.object.label, "r1"),
      gateBReview(bundle.object.label, "r2", { blinded: false }),
    ]);
    expect(evaluateGateBRelease(gateA, reviews).passed).toBe(false);
  });
});

describe("Gate C", () => {
  it("requires multiple devices and a mobile review", () => {
    const gateA = evaluateGateARelease(fiveObjects());
    const labels = fiveObjects().map((bundle) => bundle.object.label);
    const gateBReviews = labels.flatMap((label) => [gateBReview(label, "r1"), gateBReview(label, "r2")]);
    const gateB = evaluateGateBRelease(gateA, gateBReviews);
    const eligible = gateB.objects.filter((object) => object.passed).slice(0, 4).map((object) => object.objectLabel);
    const desktopOnly = eligible.map((label) => gateCReview(label, "desktop-1", "desktop"));
    expect(evaluateGateCRelease(gateB, desktopOnly).passed).toBe(false);
    const mixed = eligible.flatMap((label, index) => [
      gateCReview(label, "desktop-1", "desktop"),
      ...(index === 0 ? [gateCReview(label, "mobile-1", "mobile")] : []),
    ]);
    expect(evaluateGateCRelease(gateB, mixed).passed).toBe(true);
  });
});

describe("release verdict", () => {
  it("is ready only when all three gates pass", () => {
    const bundles = fiveObjects();
    const labels = bundles.map((bundle) => bundle.object.label);
    const b = labels.flatMap((label) => [gateBReview(label, "r1"), gateBReview(label, "r2")]);
    const c = labels.slice(0, 4).flatMap((label, index) => [
      gateCReview(label, "desktop-1", "desktop"),
      ...(index === 0 ? [gateCReview(label, "mobile-1", "mobile")] : []),
    ]);
    const verdict = buildReleaseVerdict(bundles, b, c, "2026-08-15T12:00:00.000Z");
    expect(verdict.gateA.passed).toBe(true);
    expect(verdict.gateB.passed).toBe(true);
    expect(verdict.gateC.passed).toBe(true);
    expect(verdict.releaseReady).toBe(true);
  });
});

describe("evidence parsing", () => {
  it("accepts schema v3 and rejects legacy bundles", () => {
    expect(parseValidationEvidence(evidence("bell", "metal")).ok).toBe(true);
    expect(parseValidationEvidence({ schemaVersion: 2 }).ok).toBe(false);
  });
});
