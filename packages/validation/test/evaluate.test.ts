import { describe, expect, it } from "vitest";
import {
  buildReleaseVerdict,
  evaluateGateARelease,
  evaluateGateASession,
  evaluateGateBRelease,
  evaluateGateCRelease,
  parseValidationEvidence,
} from "../src";
import { evidence, fiveObjects, gateBReview, gateCReview, fingerprint } from "./helpers";

describe("Gate A2", () => {
  it("passes exactly five qualified successful attempts inside the frozen drift bounds", () => {
    const verdict = evaluateGateASession(evidence("bell", "metal"));
    expect(verdict.passed).toBe(true);
    expect(verdict.metrics.qualifiedAttempts).toBe(5);
    expect(verdict.metrics.successfulAnalyses).toBe(5);
    expect(verdict.metrics.analyticalFailures).toBe(0);
    expect(verdict.metrics.sessionMedianDriftCents).toBeCloseTo(9, 8);
    expect(verdict.reviewAttemptId).toBe(5);
  });

  it("retains an analytical failure as one of the five qualified attempts", () => {
    const bundle = evidence("bell", "metal", { failureAttemptIds: [3] });
    const verdict = evaluateGateASession(bundle);
    expect(bundle.attempts).toHaveLength(5);
    expect(bundle.attempts[2]?.analysis.status).toBe("failure");
    expect(verdict.passed).toBe(false);
    expect(verdict.metrics.successfulAnalyses).toBe(4);
    expect(verdict.metrics.analyticalFailures).toBe(1);
    expect(verdict.reviewAttemptId).toBeNull();
    expect(verdict.reasons.some((reason) => reason.includes("cannot be replaced"))).toBe(true);
  });

  it("does not permit a sixth success to repair a failed qualified attempt", () => {
    const bundle = evidence("bell", "metal", {
      attemptCount: 6,
      failureAttemptIds: [3],
      comparisonCents: [5, 8, 10, 12, 4],
    });
    const verdict = evaluateGateASession(bundle);
    expect(verdict.passed).toBe(false);
    expect(verdict.metrics.qualifiedAttempts).toBe(6);
    expect(verdict.reasons.some((reason) => reason.includes("exactly 5 acquisition-quality-passing attempts"))).toBe(true);
  });

  it("never substitutes a later attempt for a failed reference attempt", () => {
    const bundle = evidence("bell", "metal", { failureAttemptIds: [1] });
    expect(bundle.recurrence).toHaveLength(0);
    const verdict = evaluateGateASession(bundle);
    expect(verdict.passed).toBe(false);
    expect(verdict.metrics.recurrenceComparisons).toBe(0);
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

  it("rejects non-sequential qualified attempt IDs even for typed evidence", () => {
    const bundle = evidence("bell", "metal");
    const attempts = bundle.attempts.map((attempt, index) => index === 4 ? { ...attempt, id: 9 } : attempt);
    const verdict = evaluateGateASession({ ...bundle, attempts, attemptCount: attempts.length });
    expect(verdict.passed).toBe(false);
    expect(verdict.reviewAttemptId).toBeNull();
    expect(verdict.reasons.some((reason) => reason.includes("sequential"))).toBe(true);
  });

  it("requires every retained attempt to satisfy the frozen acquisition bounds", () => {
    const bundle = evidence("bell", "metal");
    const attempts = bundle.attempts.map((attempt, index) => index === 2
      ? { ...attempt, quality: { ...attempt.quality, snrDb: 11.99 } }
      : attempt);
    const verdict = evaluateGateASession({ ...bundle, attempts });
    expect(verdict.passed).toBe(false);
    expect(verdict.metrics.qualityPassingAttempts).toBe(4);
  });

  it("accepts values exactly on the frozen acquisition boundaries", () => {
    const bundle = evidence("bell", "metal");
    const attempts = bundle.attempts.map((attempt) => ({
      ...attempt,
      quality: {
        ...attempt.quality,
        peakAmplitude: 0.02,
        snrDb: 12,
        clippedFraction: 0.001,
        secondaryTransientRatio: 0.65,
      },
    }));
    expect(evaluateGateASession({ ...bundle, attempts }).passed).toBe(true);
  });

  it("requires five distinct passing physical specimens with metal, glass, and ceramic coverage", () => {
    expect(evaluateGateARelease(fiveObjects()).passed).toBe(true);
    const alias = [...fiveObjects().slice(0, 4), evidence("desk bell", "metal", { specimenId: "specimen-bell", sessionId: "session-bell-2" })];
    const verdict = evaluateGateARelease(alias);
    expect(verdict.passed).toBe(false);
    expect(verdict.distinctPassingSpecimenCount).toBe(4);
  });

  it("rejects release evidence mixed across software revisions", () => {
    const mixed = fiveObjects().map((bundle, index) => index === 4
      ? { ...bundle, softwareRevision: "fedcba9876543210fedcba9876543210fedcba98" }
      : bundle);
    const verdict = evaluateGateARelease(mixed);
    expect(verdict.passed).toBe(false);
    expect(verdict.softwareRevision).toBeNull();
    expect(verdict.reasons.some((reason) => reason.includes("one software revision"))).toBe(true);
  });

  it("rejects duplicate session IDs and conflicting material identity", () => {
    const duplicateSession = [...fiveObjects(), evidence("another bell", "metal", { sessionId: "session-bell" })];
    expect(evaluateGateARelease(duplicateSession).passed).toBe(false);

    const conflictingMaterial = [...fiveObjects(), evidence("Bell", "ceramic", { specimenId: "specimen-bell", sessionId: "session-bell-conflict" })];
    const verdict = evaluateGateARelease(conflictingMaterial);
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.some((reason) => reason.includes("conflicting material classes for specimen IDs"))).toBe(true);
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

  it("does not count unblinded or case-duplicated reviewers", () => {
    const gateA = evaluateGateARelease(fiveObjects());
    const unblinded = [
      gateBReview("bell", "r1"),
      gateBReview("bell", "r2", { blinded: false }),
    ];
    expect(evaluateGateBRelease(gateA, unblinded).objects.find((object) => object.objectLabel === "bell")?.reviewerCount).toBe(1);

    const duplicated = [gateBReview("bell", "reviewer-1"), gateBReview("bell", "Reviewer-1")];
    expect(evaluateGateBRelease(gateA, duplicated).objects.find((object) => object.objectLabel === "bell")?.reviewerCount).toBe(1);
  });

  it("does not count a review targeting the wrong session or attempt", () => {
    const gateA = evaluateGateARelease(fiveObjects());
    const reviews = [
      gateBReview("bell", "r1"),
      gateBReview("bell", "r2", { sessionId: "session-other", attemptId: 4 }),
    ];
    const bell = evaluateGateBRelease(gateA, reviews).objects.find((object) => object.objectLabel === "bell");
    expect(bell?.reviewerCount).toBe(1);
    expect(bell?.passed).toBe(false);
  });
});

describe("Gate C", () => {
  function passingGateB() {
    const bundles = fiveObjects();
    const gateA = evaluateGateARelease(bundles);
    const labels = bundles.map((bundle) => bundle.object.label);
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

  it("does not count a device review for an ineligible attempt target", () => {
    const gateB = passingGateB();
    const review = gateCReview("bell", "mobile-1", "mobile", { attemptId: 4 });
    const bell = evaluateGateCRelease(gateB, [review]).objects.find((object) => object.objectLabel === "bell");
    expect(bell?.reviewCount).toBe(0);
  });

  it("deduplicates repeated reviewer/device/target judgments", () => {
    const gateB = passingGateB();
    const reviews = [
      gateCReview("bell", "desktop-1", "desktop"),
      gateCReview("bell", "DESKTOP-1", "desktop", { reviewId: "duplicate", identityAcrossRange: 1 }),
    ];
    const bell = evaluateGateCRelease(gateB, reviews).objects.find((object) => object.objectLabel === "bell");
    expect(bell?.reviewCount).toBe(1);
    expect(bell?.identityMedian).toBe(4);
  });

  it("rejects conflicting device classes for one normalized device ID", () => {
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
  it("is ready only when all three empirical gates pass", () => {
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
    expect(verdict.softwareRevision).toBe(bundles[0]?.softwareRevision);
    expect(verdict.releaseReady).toBe(true);
  });
});

describe("evidence parsing", () => {
  it("accepts schema v5, requires specimen and software provenance, and rejects superseded schemas", () => {
    const bundle = evidence("bell", "metal");
    expect(parseValidationEvidence(bundle).ok).toBe(true);
    expect(parseValidationEvidence({ ...bundle, object: { label: bundle.object.label, material: bundle.object.material } }).ok).toBe(false);
    const { softwareRevision: _softwareRevision, ...withoutRevision } = bundle;
    expect(parseValidationEvidence(withoutRevision).ok).toBe(false);
    expect(parseValidationEvidence({ ...bundle, softwareRevision: "deadbeef" }).ok).toBe(false);
    expect(parseValidationEvidence({ schemaVersion: 5, evidenceContractVersion: "validation-evidence-4" }).ok).toBe(false);
    expect(parseValidationEvidence({ schemaVersion: 3, evidenceContractVersion: "validation-evidence-3" }).ok).toBe(false);
  });

  it("rejects recurrence and median caches that disagree with fingerprints", () => {
    const bundle = evidence("bell", "metal");
    const recurrence = parseValidationEvidence({
      ...bundle,
      recurrence: bundle.recurrence.map((comparison, index) => index === 0
        ? { ...comparison, medianCents: comparison.medianCents + 1 }
        : comparison),
    });
    expect(recurrence.ok).toBe(false);

    const median = parseValidationEvidence({ ...bundle, medianModalDriftCents: 0 });
    expect(median.ok).toBe(false);
  });

  it("rejects reviews targeting failed qualified attempts", () => {
    const bundle = evidence("bell", "metal", { failureAttemptIds: [5] });
    const result = parseValidationEvidence({
      ...bundle,
      gateBReviews: [gateBReview("bell", "r1")],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("successful attempt");
  });

  it("rejects malformed successful fingerprints and non-sequential attempts", () => {
    const bundle = evidence("bell", "metal");
    const malformedAttempts = bundle.attempts.map((attempt, index) => index === 2 && attempt.analysis.status === "success"
      ? { ...attempt, analysis: { ...attempt.analysis, fingerprint: { ...fingerprint(8), modes: [] } } }
      : attempt);
    expect(parseValidationEvidence({ ...bundle, attempts: malformedAttempts }).ok).toBe(false);

    const nonSequential = bundle.attempts.map((attempt, index) => index === 3 ? { ...attempt, id: 9 } : attempt);
    expect(parseValidationEvidence({ ...bundle, attempts: nonSequential }).ok).toBe(false);
  });

  it("rejects duplicate logical review judgments inside one evidence bundle", () => {
    const bundle = evidence("bell", "metal");
    const first = gateBReview("bell", "Reviewer-1", { reviewId: "one" });
    const second = gateBReview("bell", "reviewer-1", { reviewId: "two" });
    const result = parseValidationEvidence({ ...bundle, gateBReviews: [first, second] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("duplicate logical");
  });
});
