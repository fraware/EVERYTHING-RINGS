import { describe, expect, it } from "vitest";
import {
  buildCanonicalReleaseVerdictForRevision,
  createGateBPlan,
  createGateCPlan,
  evaluateCanonicalGateB,
  evaluateGateARelease,
  type EmpiricalCampaignProgress,
  type GateBReview,
  type GateCReview,
} from "../src";
import { evidence, SOFTWARE_REVISION } from "./helpers";

function sixEvidence() {
  return [
    evidence("metal-a", "metal", { specimenId: "metal-a", softwareRevision: SOFTWARE_REVISION }),
    evidence("metal-b", "metal", { specimenId: "metal-b", softwareRevision: SOFTWARE_REVISION }),
    evidence("glass-a", "glass", { specimenId: "glass-a", softwareRevision: SOFTWARE_REVISION }),
    evidence("glass-b", "glass", { specimenId: "glass-b", softwareRevision: SOFTWARE_REVISION }),
    evidence("ceramic-a", "ceramic", { specimenId: "ceramic-a", softwareRevision: SOFTWARE_REVISION }),
    evidence("ceramic-b", "ceramic", { specimenId: "ceramic-b", softwareRevision: SOFTWARE_REVISION }),
  ];
}

function progress(complete: boolean): EmpiricalCampaignProgress {
  return {
    campaignId: "campaign-1",
    campaignSignature: "erc1-0000000000000000",
    authorizedSoftwareRevision: SOFTWARE_REVISION,
    plannedSpecimenCount: 12,
    plannedSessionCount: 12,
    collectedPlannedSessionCount: complete ? 12 : 11,
    conformingCompleteSessionCount: complete ? 12 : 11,
    passingSessionCount: 6,
    analyticalFailureCount: 0,
    unplannedSpecimenIds: [],
    materialCoverage: ["metal", "glass", "ceramic"],
    collectionComplete: complete,
    specimens: [],
    reasons: complete ? [] : ["one planned specimen is incomplete"],
  };
}

function bReviews(plan: Awaited<ReturnType<typeof createGateBPlan>>): GateBReview[] {
  return plan.targets.flatMap((target) => plan.reviewerIds.map((reviewerId, index) => ({
    reviewId: `b-${target.specimenId}-${index}`,
    reviewerId,
    objectLabel: target.objectLabel,
    sessionId: target.sessionId,
    attemptId: target.attemptId,
    blinded: true,
    presentationOrder: index === 0 ? "original-model" as const : "model-original" as const,
    identity: 4 as const,
    brightness: 4 as const,
    decayCharacter: 4 as const,
    artifactSeverity: 2 as const,
  })));
}

function cReviews(plan: Awaited<ReturnType<typeof createGateCPlan>>): GateCReview[] {
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

describe("canonical release authority", () => {
  it("cannot become releaseReady without campaign accounting and both frozen plans", () => {
    const result = buildCanonicalReleaseVerdictForRevision(
      sixEvidence(), [], [], "2026-08-24T16:00:00.000Z", SOFTWARE_REVISION, progress(false), undefined, undefined,
    );
    expect(result.base.gateA.passed).toBe(true);
    expect(result.releaseReady).toBe(false);
    expect(result.reasons.join("\n")).toMatch(/campaign|Gate B plan|Gate C plan/);
  });

  it("becomes ready only with the exact B and C matrices", async () => {
    const evidenceSet = sixEvidence();
    const gateA = evaluateGateARelease(evidenceSet);
    const bPlan = await createGateBPlan(gateA, ["b-1", "b-2"]);
    const gateBReviews = bReviews(bPlan);
    const b = evaluateCanonicalGateB(bPlan, gateA, gateBReviews);
    expect(b.passed).toBe(true);
    const cPlan = await createGateCPlan(b.verdict, ["c-1", "c-2"], [
      { deviceId: "desktop-1", deviceClass: "desktop" },
      { deviceId: "mobile-1", deviceClass: "mobile" },
    ]);
    const gateCReviews = cReviews(cPlan);

    const ready = buildCanonicalReleaseVerdictForRevision(
      evidenceSet,
      gateBReviews,
      gateCReviews,
      "2026-08-24T16:00:00.000Z",
      SOFTWARE_REVISION,
      progress(true),
      bPlan,
      cPlan,
    );
    expect(ready.releaseReady).toBe(true);
    expect(ready.gateB?.observedJudgmentCount).toBe(10);
    expect(ready.gateC?.observedJudgmentCount).toBe(16);

    const missing = buildCanonicalReleaseVerdictForRevision(
      evidenceSet,
      gateBReviews,
      gateCReviews.slice(0, -1),
      "2026-08-24T16:00:00.000Z",
      SOFTWARE_REVISION,
      progress(true),
      bPlan,
      cPlan,
    );
    expect(missing.releaseReady).toBe(false);
  });
});
