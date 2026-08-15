import { describe, expect, it } from "vitest";
import { evaluateGateARelease, evaluateGateBRelease, evaluateGateCRelease } from "../src";
import { evidence, gateBReview, gateCReview } from "./helpers";

function baseEvidence() {
  return [
    evidence("bell", "metal", { sessionId: "bell-a" }),
    evidence("wine glass", "glass", { sessionId: "glass-a" }),
    evidence("metal bowl", "metal", { sessionId: "bowl-a" }),
    evidence("glass bottle", "glass", { sessionId: "bottle-a" }),
    evidence("ceramic mug", "ceramic", { sessionId: "mug-a" }),
  ];
}

function reviewB(objectLabel: string, sessionId: string, reviewerId: string) {
  return gateBReview(objectLabel, reviewerId, {
    reviewId: `${sessionId}-${reviewerId}`,
    sessionId,
    attemptId: 5,
  });
}

function reviewC(
  objectLabel: string,
  sessionId: string,
  deviceId: string,
  deviceClass: "desktop" | "mobile",
) {
  return gateCReview(objectLabel, deviceId, deviceClass, {
    reviewId: `${sessionId}-${deviceId}`,
    reviewerId: `listener-${deviceId}`,
    sessionId,
    attemptId: 5,
  });
}

describe("measurement target selection", () => {
  it("does not pool Gate B reviewers across two passing sessions of one object", () => {
    const gateA = evaluateGateARelease([
      ...baseEvidence(),
      evidence("bell", "metal", { sessionId: "bell-b" }),
    ]);
    expect(gateA.passed).toBe(true);

    const gateB = evaluateGateBRelease(gateA, [
      reviewB("bell", "bell-a", "r1"),
      reviewB("bell", "bell-b", "r2"),
    ]);
    const bell = gateB.objects.find((object) => object.objectLabel === "bell");
    expect(bell?.passed).toBe(false);
    expect(bell?.selectedTarget).toBeNull();
    expect(bell?.reviewerCount).toBe(0);
    expect(bell?.reasons.some((reason) => reason.includes("single passing-session"))).toBe(true);
  });

  it("selects one Gate B target when both reviewers heard the same passing session", () => {
    const gateA = evaluateGateARelease([
      ...baseEvidence(),
      evidence("bell", "metal", { sessionId: "bell-b" }),
    ]);
    const gateB = evaluateGateBRelease(gateA, [
      reviewB("bell", "bell-b", "r1"),
      reviewB("bell", "bell-b", "r2"),
    ]);
    const bell = gateB.objects.find((object) => object.objectLabel === "bell");
    expect(bell?.passed).toBe(true);
    expect(bell?.selectedTarget).toEqual({ sessionId: "bell-b", attemptId: 5 });
    expect(bell?.reviewerCount).toBe(2);
  });

  it("Gate C inherits exactly the Gate B selected target", () => {
    const bundles = [
      ...baseEvidence(),
      evidence("bell", "metal", { sessionId: "bell-b" }),
    ];
    const gateA = evaluateGateARelease(bundles);
    const gateB = evaluateGateBRelease(gateA, [
      reviewB("bell", "bell-b", "r1"), reviewB("bell", "bell-b", "r2"),
      reviewB("wine glass", "glass-a", "r1"), reviewB("wine glass", "glass-a", "r2"),
      reviewB("metal bowl", "bowl-a", "r1"), reviewB("metal bowl", "bowl-a", "r2"),
      reviewB("glass bottle", "bottle-a", "r1"), reviewB("glass bottle", "bottle-a", "r2"),
      reviewB("ceramic mug", "mug-a", "r1"), reviewB("ceramic mug", "mug-a", "r2"),
    ]);
    expect(gateB.passed).toBe(true);

    const otherReviews = [
      reviewC("wine glass", "glass-a", "desktop-1", "desktop"),
      reviewC("metal bowl", "bowl-a", "desktop-1", "desktop"),
      reviewC("glass bottle", "bottle-a", "desktop-1", "desktop"),
      reviewC("ceramic mug", "mug-a", "desktop-1", "desktop"),
    ];

    const wrongVerdict = evaluateGateCRelease(gateB, [
      reviewC("bell", "bell-a", "mobile-1", "mobile"),
      ...otherReviews,
    ]);
    expect(wrongVerdict.objects.find((object) => object.objectLabel === "bell")?.reviewCount).toBe(0);
    expect(wrongVerdict.hasMobileDevice).toBe(false);

    const correctVerdict = evaluateGateCRelease(gateB, [
      reviewC("bell", "bell-b", "mobile-1", "mobile"),
      ...otherReviews,
    ]);
    expect(correctVerdict.objects.find((object) => object.objectLabel === "bell")?.reviewCount).toBe(1);
    expect(correctVerdict.hasMobileDevice).toBe(true);
    expect(correctVerdict.passed).toBe(true);
  });
});

describe("release identity integrity", () => {
  it("rejects duplicate session IDs", () => {
    const verdict = evaluateGateARelease([
      ...baseEvidence(),
      evidence("extra bell", "metal", { sessionId: "bell-a" }),
    ]);
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.some((reason) => reason.includes("duplicate session IDs"))).toBe(true);
  });

  it("rejects conflicting material identity even if the conflicting session fails physically", () => {
    const failingConflict = evidence("Bell", "ceramic", {
      sessionId: "bell-conflict",
      comparisonCents: [5, 8, 10, 80],
    });
    const verdict = evaluateGateARelease([
      ...baseEvidence(),
      failingConflict,
    ]);
    expect(verdict.sessions.find((session) => session.sessionId === "bell-conflict")?.passed).toBe(false);
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.some((reason) => reason.includes("conflicting material labels"))).toBe(true);
  });
});
