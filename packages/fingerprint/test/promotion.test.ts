import { describe, expect, it } from "vitest";
import {
  UNFROZEN_PHYSICAL_SONIC_TWIN_PROMOTION_POLICY,
  evaluatePhysicalSonicTwinPromotion,
  evaluateSimilarityAlgorithmPromotion,
} from "../src";

const baseline = {
  algorithmVersion: "baseline-1",
  evaluationPopulation: "digital-heldout-1",
  specimenDisjoint: true,
  queryCount: 100,
  recallAt1: 0.80,
  meanReciprocalRank: 0.86,
  rocAuc: 0.90,
  brierScore: 0.16,
  coverage: 0.8,
};

describe("similarity algorithm promotion governance", () => {
  it("promotes only a held-out candidate with a real primary improvement and no prohibited regression", () => {
    const result = evaluateSimilarityAlgorithmPromotion(baseline, {
      ...baseline,
      algorithmVersion: "candidate-2",
      recallAt1: 0.84,
      meanReciprocalRank: 0.88,
      rocAuc: 0.92,
      brierScore: 0.14,
    });
    expect(result.promoted).toBe(true);
    expect(result.improvements.recallAt1).toBeCloseTo(0.04);
  });

  it("rejects evaluation leakage and a candidate that merely changes its version name", () => {
    const leakage = evaluateSimilarityAlgorithmPromotion(baseline, { ...baseline, algorithmVersion: "candidate-leaky", specimenDisjoint: false, recallAt1: 0.95 });
    expect(leakage.promoted).toBe(false);
    expect(leakage.reasons.some((reason) => reason.includes("specimen-disjoint"))).toBe(true);

    const noImprovement = evaluateSimilarityAlgorithmPromotion(baseline, { ...baseline, algorithmVersion: "candidate-same" });
    expect(noImprovement.promoted).toBe(false);
    expect(noImprovement.reasons.some((reason) => reason.includes("does not improve"))).toBe(true);
  });
});

describe("physical Sonic Twin promotion policy", () => {
  it("treats the unfrozen preregistration template as not product-eligible", () => {
    expect(UNFROZEN_PHYSICAL_SONIC_TWIN_PROMOTION_POLICY.policyVersion).toBe("physical-sonic-twin-promotion-policy-1");
    expect(UNFROZEN_PHYSICAL_SONIC_TWIN_PROMOTION_POLICY.freezeState).toBe("unfrozen-template");
    expect(UNFROZEN_PHYSICAL_SONIC_TWIN_PROMOTION_POLICY.productEligible).toBe(false);
    expect(UNFROZEN_PHYSICAL_SONIC_TWIN_PROMOTION_POLICY.minimumHeldOutSpecimenCount).toBeNull();
    expect(UNFROZEN_PHYSICAL_SONIC_TWIN_PROMOTION_POLICY.maximumFalseMatchRate).toBeNull();

    const verdict = evaluatePhysicalSonicTwinPromotion(UNFROZEN_PHYSICAL_SONIC_TWIN_PROMOTION_POLICY, {
      metricsVersion: "physical-sonic-twin-held-out-metrics-1",
      evaluationPopulation: "unassigned",
      specimenDisjoint: true,
      heldOutSpecimenCount: 10_000,
      heldOutQueryCount: 10_000,
      stationCount: 50,
      falseMatchRate: 0,
      trueNegativeRate: 1,
      coverage: 1,
      brierScore: 0,
      ece: 0,
      recallAt1: 1,
    });
    expect(verdict.productEligible).toBe(false);
    expect(verdict.promoted).toBe(false);
    expect(verdict.reasons.some((reason) => reason.includes("unfrozen preregistration template"))).toBe(true);
  });
});
