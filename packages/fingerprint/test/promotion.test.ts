import { describe, expect, it } from "vitest";
import { evaluateSimilarityAlgorithmPromotion } from "../src";

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
