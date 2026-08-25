import { describe, expect, it } from "vitest";
import { fitIsotonicCalibration, predictCalibratedProbability } from "../src";

describe("isotonic calibration correctness", () => {
  it("pools conflicting labels at an identical score before PAV", () => {
    const model = fitIsotonicCalibration([
      { pairId: "negative-at-tie", score: 0.5, samePhysicalSpecimen: false },
      { pairId: "positive-at-tie", score: 0.5, samePhysicalSpecimen: true },
    ], "tie-population");
    expect(model.calibrationVersion).toBe("sonic-twin-isotonic-calibration-2");
    expect(model.bins).toHaveLength(1);
    expect(model.bins[0]).toMatchObject({
      minimumScore: 0.5,
      maximumScore: 0.5,
      sampleCount: 2,
      positiveCount: 1,
      probability: 0.5,
    });
    expect(predictCalibratedProbability(model, 0.5)).toBe(0.5);
  });

  it("is invariant to pair identifiers and input order when scores are tied", () => {
    const left = fitIsotonicCalibration([
      { pairId: "a-negative", score: 0.4, samePhysicalSpecimen: false },
      { pairId: "z-positive", score: 0.4, samePhysicalSpecimen: true },
      { pairId: "high-positive", score: 0.9, samePhysicalSpecimen: true },
    ], "tie-order-population");
    const right = fitIsotonicCalibration([
      { pairId: "renamed-high", score: 0.9, samePhysicalSpecimen: true },
      { pairId: "aa-positive", score: 0.4, samePhysicalSpecimen: true },
      { pairId: "zz-negative", score: 0.4, samePhysicalSpecimen: false },
    ], "tie-order-population");
    expect(right.bins).toEqual(left.bins);
    expect(predictCalibratedProbability(right, 0.4)).toBe(predictCalibratedProbability(left, 0.4));
  });

  it("still pools adjacent score blocks when their empirical rates violate monotonicity", () => {
    const model = fitIsotonicCalibration([
      { pairId: "low-positive", score: 0.1, samePhysicalSpecimen: true },
      { pairId: "middle-negative", score: 0.5, samePhysicalSpecimen: false },
      { pairId: "high-positive", score: 0.9, samePhysicalSpecimen: true },
    ], "pav-population");
    expect(model.bins[0]?.probability).toBe(0.5);
    expect(model.bins[0]?.sampleCount).toBe(2);
    expect(model.bins[1]?.probability).toBe(1);
  });

  it("rejects one-class fitting because it cannot calibrate same-specimen probability", () => {
    expect(() => fitIsotonicCalibration([
      { pairId: "positive-1", score: 0.8, samePhysicalSpecimen: true },
      { pairId: "positive-2", score: 0.9, samePhysicalSpecimen: true },
    ], "one-class-population")).toThrow(/negative example/);
  });
});
