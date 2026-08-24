import { describe, expect, it } from "vitest";
import { fitAndEvaluateHeldOutCalibration, type PartitionedSimilarityScoreV1 } from "../src";

const samples: readonly PartitionedSimilarityScoreV1[] = [
  { pairId: "cal-a-pos", groupId: "cal-a", partition: "calibration", score: 0.92, samePhysicalSpecimen: true },
  { pairId: "cal-a-neg", groupId: "cal-a", partition: "calibration", score: 0.18, samePhysicalSpecimen: false },
  { pairId: "cal-b-pos", groupId: "cal-b", partition: "calibration", score: 0.84, samePhysicalSpecimen: true },
  { pairId: "cal-b-neg", groupId: "cal-b", partition: "calibration", score: 0.25, samePhysicalSpecimen: false },
  { pairId: "eval-c-pos", groupId: "eval-c", partition: "evaluation", score: 0.88, samePhysicalSpecimen: true },
  { pairId: "eval-c-neg", groupId: "eval-c", partition: "evaluation", score: 0.12, samePhysicalSpecimen: false },
  { pairId: "eval-d-pos", groupId: "eval-d", partition: "evaluation", score: 0.79, samePhysicalSpecimen: true },
  { pairId: "eval-d-neg", groupId: "eval-d", partition: "evaluation", score: 0.30, samePhysicalSpecimen: false },
];

describe("held-out Sonic Twin calibration", () => {
  it("fits only on calibration groups and reports only group-disjoint evaluation metrics", () => {
    const report = fitAndEvaluateHeldOutCalibration(samples, "digital-calibration-population", "digital-evaluation-population", 4, [0, 0.25]);
    expect(report.calibrationSampleCount).toBe(4);
    expect(report.evaluationSampleCount).toBe(4);
    expect(report.model.trainingSampleCount).toBe(4);
    expect(report.predictions).toHaveLength(4);
    expect(report.metrics.sampleCount).toBe(4);
    expect(report.metrics.rocAuc).toBe(1);
    expect(new Set(report.calibrationGroups)).toEqual(new Set(["cal-a", "cal-b"]));
    expect(new Set(report.evaluationGroups)).toEqual(new Set(["eval-c", "eval-d"]));
  });

  it("rejects group leakage across calibration and evaluation partitions", () => {
    const leaking = [...samples, { pairId: "leak", groupId: "cal-a", partition: "evaluation" as const, score: 0.5, samePhysicalSpecimen: false }];
    expect(() => fitAndEvaluateHeldOutCalibration(leaking, "cal", "eval")).toThrow(/leakage/);
  });

  it("rejects evaluation sets that cannot measure both classes", () => {
    const oneClass = samples.filter((sample) => sample.partition === "calibration" || sample.samePhysicalSpecimen);
    expect(() => fitAndEvaluateHeldOutCalibration(oneClass, "cal", "eval")).toThrow(/negative/);
  });
});
