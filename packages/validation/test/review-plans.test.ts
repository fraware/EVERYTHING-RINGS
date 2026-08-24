import { describe, expect, it } from "vitest";
import {
  createGateBPlan,
  createGateCPlan,
  evaluateCanonicalGateB,
  evaluateCanonicalGateC,
  evaluateGateARelease,
  evaluateGateBRelease,
  type GateBReview,
  type GateCReview,
} from "../src";
import { evidence } from "./helpers";

function sixObjects() {
  return [
    evidence("metal-a", "metal", { specimenId: "metal-a" }),
    evidence("metal-b", "metal", { specimenId: "metal-b" }),
    evidence("glass-a", "glass", { specimenId: "glass-a" }),
    evidence("glass-b", "glass", { specimenId: "glass-b" }),
    evidence("ceramic-a", "ceramic", { specimenId: "ceramic-a" }),
    evidence("ceramic-b", "ceramic", { specimenId: "ceramic-b" }),
  ];
}

function gateBReviews(plan: ReturnType<typeof createGateBPlan>): GateBReview[] {
  return plan.targets.flatMap((target) => plan.reviewerIds.map((reviewerId, index) => ({
    reviewId: `b-${target.specimenId}-${index}`,
    reviewerId,
    objectLabel: target.objectLabel,
    sessionId: target.sessionId,
    attemptId: target.attemptId,
    blinded: true,
    presentationOrder: index % 2 === 0 ? "original-model" as const : "model-original" as const,
    identity: 4 as const,
    brightness: 4 as const,
    decayCharacter: 4 as const,
    artifactSeverity: 2 as const,
  })));
}

function gateCReviews(plan: ReturnType<typeof createGateCPlan>): GateCReview[] {
  return plan.targets.flatMap((target) => plan.reviewerIds.flatMap((reviewerId) => plan.devices.map((device) => ({
    reviewId: `c-${target.specimenId}-${reviewerId}-${device.deviceId}`,
    reviewerId,
    objectLabel: target.objectLabel,
    sessionId: target.sessionId,
    attemptId: target.attemptId,
    deviceId: device.deviceId,
    deviceClass: device.deviceClass,
    identityAcrossRange: 4 as const,
    timbreContinuity: 4 as const,
    usefulSemitoneSpan: 12,
    latencyAcceptable: true,
  }))));
}

describe("canonical post-collection plans", () => {
  it("selects exactly five Gate B targets including metal, glass, and ceramic", () => {
    const gateA = evaluateGateARelease(sixObjects());
    expect(gateA.passed).toBe(true);
    const plan = createGateBPlan(gateA, ["reviewer-a", "reviewer-b"]);
    expect(plan.targets).toHaveLength(5);
    const materialBySpecimen = new Map(gateA.sessions.map((session) => [session.specimenId, session.material]));
    const materials = new Set(plan.targets.map((target) => materialBySpecimen.get(target.specimenId)));
    expect(materials.has("metal")).toBe(true);
    expect(materials.has("glass")).toBe(true);
    expect(materials.has("ceramic")).toBe(true);
  });

  it("rejects Gate B when one fixed-panel judgment is missing", () => {
    const gateA = evaluateGateARelease(sixObjects());
    const plan = createGateBPlan(gateA, ["reviewer-a", "reviewer-b"]);
    const reviews = gateBReviews(plan);
    expect(evaluateCanonicalGateB(plan, gateA, reviews).passed).toBe(true);
    const missing = reviews.slice(0, -1);
    const result = evaluateCanonicalGateB(plan, gateA, missing);
    expect(result.passed).toBe(false);
    expect(result.observedJudgmentCount).toBe(9);
  });

  it("requires the full four-target by two-reviewer by two-device Gate C matrix", () => {
    const gateA = evaluateGateARelease(sixObjects());
    const gateBPlan = createGateBPlan(gateA, ["reviewer-a", "reviewer-b"]);
    const gateBReviewsAll = gateBReviews(gateBPlan);
    const canonicalB = evaluateCanonicalGateB(gateBPlan, gateA, gateBReviewsAll);
    expect(canonicalB.passed).toBe(true);

    const gateCPlan = createGateCPlan(canonicalB.verdict, ["reviewer-c", "reviewer-d"], [
      { deviceId: "desktop-1", deviceClass: "desktop" },
      { deviceId: "phone-1", deviceClass: "mobile" },
    ]);
    const reviews = gateCReviews(gateCPlan);
    expect(reviews).toHaveLength(16);
    expect(evaluateCanonicalGateC(gateCPlan, canonicalB.verdict, reviews).passed).toBe(true);

    const missingCell = reviews.filter((_, index) => index !== 0);
    const result = evaluateCanonicalGateC(gateCPlan, canonicalB.verdict, missingCell);
    expect(result.passed).toBe(false);
    expect(result.observedJudgmentCount).toBe(15);
  });

  it("rejects a Gate C plan without a mobile device", () => {
    const gateA = evaluateGateARelease(sixObjects());
    const bPlan = createGateBPlan(gateA, ["reviewer-a", "reviewer-b"]);
    const bVerdict = evaluateGateBRelease(gateA, gateBReviews(bPlan));
    expect(() => createGateCPlan(bVerdict, ["reviewer-c", "reviewer-d"], [
      { deviceId: "desktop-1", deviceClass: "desktop" },
      { deviceId: "desktop-2", deviceClass: "desktop" },
    ])).toThrow(/mobile/);
  });
});
