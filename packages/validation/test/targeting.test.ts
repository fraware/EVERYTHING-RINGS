import { describe, expect, it } from "vitest";
import {
  evaluateGateARelease,
  evaluateGateBRelease,
  evaluateGateCRelease,
  type GateBReview,
  type GateCReview,
  type MaterialClass,
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
      decaySeconds: 0.5 / (index + 1),
      q: 120,
      confidence: 0.9,
      diagnostics: {
        prominenceDb: 20,
        persistenceSeconds: 0.25,
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
  sessionId: string,
  drifts: readonly number[] = [5, 8, 10, 12],
): ValidationEvidenceV3 {
  const records = [0, ...drifts].map((drift, index) => ({
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
    sessionId,
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
    recordCount: records.length,
    medianModalDriftCents: deriveMedianModalDriftCents(records),
    recurrence: deriveEvidenceRecurrence(records),
    records,
    gateBReviews: [],
    gateCReviews: [],
    rawMicrophoneSamplesIncluded: false,
  };
}

function baseEvidence(): ValidationEvidenceV3[] {
  return [
    evidence("bell", "metal", "bell-a"),
    evidence("wine glass", "glass", "glass-a"),
    evidence("metal bowl", "metal", "bowl-a"),
    evidence("glass bottle", "glass", "bottle-a"),
    evidence("ceramic mug", "ceramic", "mug-a"),
  ];
}

function gateBReview(
  objectLabel: string,
  sessionId: string,
  reviewerId: string,
): GateBReview {
  return {
    reviewId: `${sessionId}-${reviewerId}`,
    reviewerId,
    objectLabel,
    sessionId,
    recordId: 5,
    blinded: true,
    presentationOrder: "original-model",
    identity: 4,
    brightness: 4,
    decayCharacter: 4,
    artifactSeverity: 2,
  };
}

function gateCReview(
  objectLabel: string,
  sessionId: string,
  deviceId: string,
  deviceClass: "desktop" | "mobile",
): GateCReview {
  return {
    reviewId: `${sessionId}-${deviceId}`,
    reviewerId: `listener-${deviceId}`,
    objectLabel,
    sessionId,
    recordId: 5,
    deviceId,
    deviceClass,
    identityAcrossRange: 4,
    timbreContinuity: 4,
    usefulSemitoneSpan: 12,
    latencyAcceptable: true,
  };
}

describe("measurement target selection", () => {
  it("does not pool Gate B reviewers across two passing sessions of one object", () => {
    const gateA = evaluateGateARelease([
      ...baseEvidence(),
      evidence("bell", "metal", "bell-b"),
    ]);
    expect(gateA.passed).toBe(true);

    const reviews = [
      gateBReview("bell", "bell-a", "r1"),
      gateBReview("bell", "bell-b", "r2"),
    ];
    const gateB = evaluateGateBRelease(gateA, reviews);
    const bell = gateB.objects.find((object) => object.objectLabel === "bell");
    expect(bell?.passed).toBe(false);
    expect(bell?.selectedTarget).toBeNull();
    expect(bell?.reviewerCount).toBe(0);
    expect(bell?.reasons.some((reason) => reason.includes("single passing-session"))).toBe(true);
  });

  it("selects one Gate B target when both reviewers heard the same passing session", () => {
    const gateA = evaluateGateARelease([
      ...baseEvidence(),
      evidence("bell", "metal", "bell-b"),
    ]);
    const reviews = [
      gateBReview("bell", "bell-b", "r1"),
      gateBReview("bell", "bell-b", "r2"),
    ];
    const gateB = evaluateGateBRelease(gateA, reviews);
    const bell = gateB.objects.find((object) => object.objectLabel === "bell");
    expect(bell?.passed).toBe(true);
    expect(bell?.selectedTarget).toEqual({ sessionId: "bell-b", recordId: 5 });
    expect(bell?.reviewerCount).toBe(2);
  });

  it("Gate C inherits exactly the Gate B selected target", () => {
    const bundles = [
      ...baseEvidence(),
      evidence("bell", "metal", "bell-b"),
    ];
    const gateA = evaluateGateARelease(bundles);
    const allB = [
      gateBReview("bell", "bell-b", "r1"), gateBReview("bell", "bell-b", "r2"),
      gateBReview("wine glass", "glass-a", "r1"), gateBReview("wine glass", "glass-a", "r2"),
      gateBReview("metal bowl", "bowl-a", "r1"), gateBReview("metal bowl", "bowl-a", "r2"),
      gateBReview("glass bottle", "bottle-a", "r1"), gateBReview("glass bottle", "bottle-a", "r2"),
      gateBReview("ceramic mug", "mug-a", "r1"), gateBReview("ceramic mug", "mug-a", "r2"),
    ];
    const gateB = evaluateGateBRelease(gateA, allB);
    expect(gateB.passed).toBe(true);

    const wrongBell = gateCReview("bell", "bell-a", "mobile-1", "mobile");
    const correctOthers = [
      gateCReview("wine glass", "glass-a", "desktop-1", "desktop"),
      gateCReview("metal bowl", "bowl-a", "desktop-1", "desktop"),
      gateCReview("glass bottle", "bottle-a", "desktop-1", "desktop"),
      gateCReview("ceramic mug", "mug-a", "desktop-1", "desktop"),
    ];
    const wrongVerdict = evaluateGateCRelease(gateB, [wrongBell, ...correctOthers]);
    const bellWrong = wrongVerdict.objects.find((object) => object.objectLabel === "bell");
    expect(bellWrong?.reviewCount).toBe(0);
    expect(wrongVerdict.hasMobileDevice).toBe(false);

    const correctBell = gateCReview("bell", "bell-b", "mobile-1", "mobile");
    const correctVerdict = evaluateGateCRelease(gateB, [correctBell, ...correctOthers]);
    const bellCorrect = correctVerdict.objects.find((object) => object.objectLabel === "bell");
    expect(bellCorrect?.reviewCount).toBe(1);
    expect(correctVerdict.hasMobileDevice).toBe(true);
    expect(correctVerdict.passed).toBe(true);
  });
});

describe("release identity integrity", () => {
  it("rejects duplicate session IDs", () => {
    const verdict = evaluateGateARelease([
      ...baseEvidence(),
      evidence("extra bell", "metal", "bell-a"),
    ]);
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.some((reason) => reason.includes("duplicate session IDs"))).toBe(true);
  });

  it("rejects conflicting material identity even if the conflicting session fails physically", () => {
    const failingConflict = evidence("Bell", "ceramic", "bell-conflict", [5, 8, 10, 80]);
    const verdict = evaluateGateARelease([
      ...baseEvidence(),
      failingConflict,
    ]);
    expect(verdict.sessions.find((session) => session.sessionId === "bell-conflict")?.passed).toBe(false);
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.some((reason) => reason.includes("conflicting material labels"))).toBe(true);
  });
});
