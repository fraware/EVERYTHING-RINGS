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

function evidence(
  label: string,
  material: MaterialClass,
  options: {
    readonly comparisonCents?: readonly number[];
    readonly recordCount?: number;
    readonly sessionId?: string;
  } = {},
): ValidationEvidenceV3 {
  const recordCount = options.recordCount ?? 5;
  const comparisonCents = options.comparisonCents ?? [5, 8, 10, 12];
  const records = Array.from({ length: recordCount }, (_, index) => ({
    id: index + 1,
    quality: {
      score: 0.95,
      snrDb: 30,
      clippedFraction: 0,
      peakAmplitude: 0.5,
      secondaryTransientRatio: 0.05,
    },
    fingerprint: fingerprint(index === 0 ? 0 : comparisonCents[index - 1] ?? 0),
  }));
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
    medianModalDriftCents: deriveMedianModalDriftCents(records),
    recurrence: deriveEvidenceRecurrence(records),
    records,
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

function targetFor(objectLabel: string): { readonly sessionId: string; readonly recordId: number } {
  return { sessionId: `session-${objectLabel}`, recordId: 5 };
}

function gateBReview(objectLabel: string, reviewerId: string, overrides: Partial<GateBReview> = {}): GateBReview {
  return {
    reviewId: `${objectLabel}-${reviewerId}`,
    reviewerId,
    objectLabel,
    ...targetFor(objectLabel),
    blinded: true,
    presentationOrder: "original-model",
    identity: 4,
    brightness: 4,
    decayCharacter: 4,
    artifactSeverity: 2,
    ...overrides,
  };
}

function gateCReview(
  objectLabel: string,
  deviceId: string,
  deviceClass: "desktop" | "mobile",
  overrides: Partial<GateCReview> = {},
): GateCReview {
  return {
    reviewId: `${objectLabel}-${deviceId}-${overrides.reviewerId ?? "listener-1"}`,
    reviewerId: "listener-1",
    objectLabel,
    ...targetFor(objectLabel),
    deviceId,
    deviceClass,
    identityAcrossRange: 4,
    timbreContinuity: 4,
    usefulSemitoneSpan: 12,
    latencyAcceptable: true,
    ...overrides,
  };
}

describe("Gate A", () => {
  it("passes a five-strike fixed-setup session inside the frozen drift bounds", () => {
    const verdict = evaluateGateASession(evidence("bell", "metal"));
    expect(verdict.passed).toBe(true);
    expect(verdict.metrics.acceptedStrikes).toBe(5);
    expect(verdict.metrics.sessionMedianDriftCents).toBeCloseTo(9, 8);
    expect(verdict.reviewRecordId).toBe(5);
  });

  it("rejects optional stopping beyond the five accepted strikes", () => {
    const verdict = evaluateGateASession(evidence("bell", "metal", {
      recordCount: 6,
      comparisonCents: [5, 8, 10, 12, 2],
    }));
    expect(verdict.passed).toBe(false);
    expect(verdict.reviewRecordId).toBeNull();
    expect(verdict.reasons.some((reason) => reason.includes("exactly 5 accepted strikes"))).toBe(true);
    expect(verdict.reasons.some((reason) => reason.includes("exactly 4 recurrence comparisons"))).toBe(true);
  });

  it("rejects a recurrence tail above the frozen worst-comparison bound", () => {
    const verdict = evaluateGateASession(evidence("bell", "metal", { comparisonCents: [4, 5, 6, 51] }));
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.some((reason) => reason.includes("worst comparison"))).toBe(true);
  });

  it("recomputes recurrence from fingerprints instead of trusting cached summaries", () => {
    const bundle = evidence("bell", "metal");
    const tampered = {
      ...bundle,
      recurrence: bundle.recurrence.map((comparison) => ({ ...comparison, medianCents: 0, matchedCount: 0 })),
      medianModalDriftCents: 0,
    };
    const verdict = evaluateGateASession(tampered);
    expect(verdict.passed).toBe(true);
    expect(verdict.metrics.comparisonsWithEnoughMatches).toBe(4);
    expect(verdict.metrics.sessionMedianDriftCents).toBeCloseTo(9, 8);
  });

  it("rejects non-sequential measurement IDs even for typed evidence", () => {
    const bundle = evidence("bell", "metal");
    const records = bundle.records.map((record, index) => index === 4 ? { ...record, id: 9 } : record);
    const verdict = evaluateGateASession({ ...bundle, records, recordCount: records.length });
    expect(verdict.passed).toBe(false);
    expect(verdict.reviewRecordId).toBeNull();
    expect(verdict.reasons.some((reason) => reason.includes("sequential"))).toBe(true);
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

  it("does not count case variants of one reviewer as independent reviewers", () => {
    const gateA = evaluateGateARelease(fiveObjects());
    const bellReviews = [gateBReview("bell", "reviewer-1"), gateBReview("bell", "Reviewer-1")];
    const verdict = evaluateGateBRelease(gateA, bellReviews);
    const bell = verdict.objects.find((object) => object.objectLabel === "bell");
    expect(bell?.reviewerCount).toBe(1);
    expect(bell?.passed).toBe(false);
  });

  it("does not count a review targeting the wrong session or measurement", () => {
    const gateA = evaluateGateARelease(fiveObjects());
    const labels = fiveObjects().map((bundle) => bundle.object.label);
    const reviews = labels.flatMap((label) => [gateBReview(label, "r1"), gateBReview(label, "r2")]);
    const corrupted = reviews.map((review) => review.objectLabel === "bell" && review.reviewerId === "r2"
      ? { ...review, sessionId: "session-other", recordId: 4 }
      : review);
    const verdict = evaluateGateBRelease(gateA, corrupted);
    const bell = verdict.objects.find((object) => object.objectLabel === "bell");
    expect(bell?.reviewerCount).toBe(1);
    expect(bell?.passed).toBe(false);
  });
});

describe("Gate C", () => {
  function passingGateB() {
    const gateA = evaluateGateARelease(fiveObjects());
    const labels = fiveObjects().map((bundle) => bundle.object.label);
    return evaluateGateBRelease(
      gateA,
      labels.flatMap((label) => [gateBReview(label, "r1"), gateBReview(label, "r2")]),
    );
  }

  it("requires multiple devices and a mobile review", () => {
    const gateB = passingGateB();
    const eligible = gateB.objects.filter((object) => object.passed).slice(0, 4).map((object) => object.objectLabel);
    const desktopOnly = eligible.map((label) => gateCReview(label, "desktop-1", "desktop"));
    expect(evaluateGateCRelease(gateB, desktopOnly).passed).toBe(false);
    const mixed = eligible.flatMap((label, index) => [
      gateCReview(label, "desktop-1", "desktop"),
      ...(index === 0 ? [gateCReview(label, "mobile-1", "mobile")] : []),
    ]);
    expect(evaluateGateCRelease(gateB, mixed).passed).toBe(true);
  });

  it("does not count a device review for an ineligible measurement target", () => {
    const gateB = passingGateB();
    const review = gateCReview("bell", "mobile-1", "mobile", { recordId: 4 });
    const verdict = evaluateGateCRelease(gateB, [review]);
    const bell = verdict.objects.find((object) => object.objectLabel === "bell");
    expect(bell?.reviewCount).toBe(0);
  });

  it("deduplicates repeated reviews from the same reviewer, device, and target", () => {
    const gateB = passingGateB();
    const reviews = [
      gateCReview("bell", "desktop-1", "desktop"),
      gateCReview("bell", "DESKTOP-1", "desktop", { reviewId: "duplicate", identityAcrossRange: 1 }),
    ];
    const verdict = evaluateGateCRelease(gateB, reviews);
    const bell = verdict.objects.find((object) => object.objectLabel === "bell");
    expect(bell?.reviewCount).toBe(1);
    expect(bell?.identityMedian).toBe(4);
  });

  it("rejects conflicting device classes for one device identifier", () => {
    const gateB = passingGateB();
    const eligible = gateB.objects.filter((object) => object.passed).slice(0, 4).map((object) => object.objectLabel);
    const reviews = eligible.flatMap((label, index) => [
      gateCReview(label, "device-1", index === 0 ? "mobile" : "desktop", { reviewerId: `r-${index}` }),
      ...(index === 0 ? [gateCReview(label, "device-2", "desktop", { reviewerId: "r-extra" })] : []),
    ]);
    const verdict = evaluateGateCRelease(gateB, reviews);
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.some((reason) => reason.includes("conflicting device classes"))).toBe(true);
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

  it("rejects a recurrence cache that disagrees with the fingerprints", () => {
    const bundle = evidence("bell", "metal");
    const result = parseValidationEvidence({
      ...bundle,
      recurrence: bundle.recurrence.map((comparison, index) => index === 0
        ? { ...comparison, medianCents: comparison.medianCents + 1 }
        : comparison),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("recurrence cache");
  });

  it("rejects a cached session median that disagrees with the fingerprints", () => {
    const bundle = evidence("bell", "metal");
    const result = parseValidationEvidence({ ...bundle, medianModalDriftCents: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("median modal drift cache");
  });

  it("rejects reviews that do not target their owning session", () => {
    const bundle = evidence("bell", "metal");
    const corrupted = {
      ...bundle,
      gateBReviews: [gateBReview("bell", "r1", { sessionId: "session-other" })],
    };
    const result = parseValidationEvidence(corrupted);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Gate B review target");
  });

  it("rejects reviews targeting missing records", () => {
    const bundle = evidence("bell", "metal");
    const result = parseValidationEvidence({
      ...bundle,
      gateCReviews: [gateCReview("bell", "mobile-1", "mobile", { recordId: 99 })],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate or non-sequential measurement record IDs", () => {
    const bundle = evidence("bell", "metal");
    const duplicate = bundle.records.map((record, index) => index === 1 ? { ...record, id: 1 } : record);
    expect(parseValidationEvidence({ ...bundle, records: duplicate }).ok).toBe(false);

    const nonSequential = bundle.records.map((record, index) => index === 4 ? { ...record, id: 9 } : record);
    expect(parseValidationEvidence({ ...bundle, records: nonSequential }).ok).toBe(false);
  });

  it("rejects malformed modal diagnostics", () => {
    const bundle = evidence("bell", "metal");
    const first = bundle.records[0];
    if (first === undefined) throw new Error("missing fixture record");
    const firstMode = first.fingerprint.modes[0];
    if (firstMode === undefined) throw new Error("missing fixture mode");
    const malformed = {
      ...bundle,
      records: [
        {
          ...first,
          fingerprint: {
            ...first.fingerprint,
            modes: [{ ...firstMode, confidence: 1.5 }, ...first.fingerprint.modes.slice(1)],
          },
        },
        ...bundle.records.slice(1),
      ],
    };
    expect(parseValidationEvidence(malformed).ok).toBe(false);
  });

  it("rejects duplicate review IDs in one evidence bundle", () => {
    const bundle = evidence("bell", "metal");
    const result = parseValidationEvidence({
      ...bundle,
      gateBReviews: [gateBReview("bell", "r1", { reviewId: "same" })],
      gateCReviews: [gateCReview("bell", "mobile-1", "mobile", { reviewId: "same" })],
    });
    expect(result.ok).toBe(false);
  });
});
