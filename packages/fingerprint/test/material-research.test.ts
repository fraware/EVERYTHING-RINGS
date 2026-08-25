import { describe, expect, it } from "vitest";
import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import {
  assignMaterialAssertion,
  benchmarkMaterialResearch,
  buildAcousticObjectModel,
  createMaterialAssertion,
  fitAndBenchmarkMaterialFamilyDisjoint,
  fitMaterialCentroidResearch,
  isInferredMaterialAssertion,
  isVerifiedMaterialAssertion,
  materialExamplesEligibleForTraining,
  predictMaterialResearch,
} from "../src";

function fp(base: number, ratios: readonly number[], decays: readonly number[]): AcousticFingerprintV1 {
  return {
    version: 1,
    algorithmVersion: "er-dsp-2",
    sampleRate: 48_000,
    durationSeconds: 2,
    modes: ratios.map((ratio, index) => ({
      frequencyHz: base * ratio,
      relativeAmplitude: 1 / (index + 1),
      decaySeconds: decays[index] ?? 0.4,
      q: 100,
      confidence: 0.9,
      diagnostics: { prominenceDb: 20, persistenceSeconds: 0.2, frequencyStdCents: 2, decayFitScore: 0.95, observationCount: 12 },
    })),
  };
}

function model(specimenId: string, fingerprints: readonly AcousticFingerprintV1[]) {
  return buildAcousticObjectModel(fingerprints.map((fingerprint, index) => ({ observationId: `${specimenId}-${index}`, specimenId, fingerprint })));
}

describe("research-only material inference", () => {
  it("learns population-bound modal centroids and abstains when evidence margin is weak", () => {
    const metalA = model("metal-a", [fp(440, [1, 2.05, 3.2], [1.1, 0.8, 0.6]), fp(442, [1, 2.04, 3.19], [1.05, 0.78, 0.58])]);
    const metalB = model("metal-b", [fp(500, [1, 2.02, 3.15], [1.0, 0.75, 0.55]), fp(502, [1, 2.03, 3.16], [1.02, 0.77, 0.56])]);
    const glassA = model("glass-a", [fp(600, [1, 2.45, 4.1], [1.8, 1.3, 1.0]), fp(602, [1, 2.44, 4.08], [1.75, 1.28, 0.98])]);
    const glassB = model("glass-b", [fp(670, [1, 2.48, 4.12], [1.7, 1.25, 0.95]), fp(672, [1, 2.47, 4.11], [1.72, 1.27, 0.96])]);
    const research = fitMaterialCentroidResearch([
      { exampleId: "ma", materialLabel: "metal", model: metalA },
      { exampleId: "mb", materialLabel: "metal", model: metalB },
      { exampleId: "ga", materialLabel: "glass", model: glassA },
      { exampleId: "gb", materialLabel: "glass", model: glassB },
    ], "digital-material-population-1");
    expect(research.evidenceEligible).toBe(false);
    expect(research.centroids).toHaveLength(2);

    const metalQuery = model("metal-q", [fp(550, [1, 2.04, 3.18], [1.03, 0.77, 0.57]), fp(552, [1, 2.03, 3.17], [1.01, 0.76, 0.56])]);
    const prediction = predictMaterialResearch(research, metalQuery, 0.005);
    expect(prediction.decision).toBe("label");
    expect(prediction.materialLabel).toBe("metal");
    expect(prediction.calibratedProbability).toBeNull();
    expect(prediction.trainingPopulation).toBe("digital-material-population-1");

    const ambiguous = predictMaterialResearch(research, metalQuery, 10);
    expect(ambiguous.decision).toBe("abstain");
    expect(ambiguous.materialLabel).toBeNull();
  });

  it("reports coverage and covered accuracy without turning software labels into a physical claim", () => {
    const metal = model("metal", [fp(440, [1, 2, 3], [1, 0.8, 0.6]), fp(441, [1, 2, 3], [1, 0.8, 0.6])]);
    const glass = model("glass", [fp(600, [1, 2.5, 4], [1.8, 1.3, 1]), fp(601, [1, 2.5, 4], [1.8, 1.3, 1])]);
    const fitted = fitMaterialCentroidResearch([
      { exampleId: "m", materialLabel: "metal", model: metal },
      { exampleId: "g", materialLabel: "glass", model: glass },
    ], "digital-two-class-1");
    const report = benchmarkMaterialResearch(fitted, [
      { exampleId: "mt", trueMaterialLabel: "metal", model: metal },
      { exampleId: "gt", trueMaterialLabel: "glass", model: glass },
    ], 0);
    expect(report.coverage).toBe(1);
    expect(report.coveredAccuracy).toBe(1);
    expect(report.macroF1).toBe(1);
    expect(report.balancedAccuracy).toBe(1);
    expect(report.errors).toHaveLength(0);
  });

  it("preserves verified material provenance and rejects inferred overwrite", () => {
    const verified = createMaterialAssertion({
      materialLabel: "bronze",
      source: "manufacturer",
      sourceReference: "foundry-lot-1",
      confidenceClass: "verified",
      algorithmDerivationId: null,
    });
    const inferred = createMaterialAssertion({
      materialLabel: "glass",
      source: "inferred",
      sourceReference: null,
      confidenceClass: "inferred",
      algorithmDerivationId: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    });
    expect(isVerifiedMaterialAssertion(verified)).toBe(true);
    expect(isInferredMaterialAssertion(inferred)).toBe(true);
    expect(() => assignMaterialAssertion(verified, inferred)).toThrow(/must not overwrite verified truth/);
    expect(assignMaterialAssertion(inferred, verified).materialLabel).toBe("bronze");
  });

  it("evaluates family-disjoint splits so object-family shortcut can be measured", () => {
    const metalBell = model("metal-bell", [fp(440, [1, 2.05, 3.2], [1.1, 0.8, 0.6]), fp(442, [1, 2.04, 3.19], [1.05, 0.78, 0.58])]);
    const metalBowl = model("metal-bowl", [fp(500, [1, 2.02, 3.15], [1.0, 0.75, 0.55]), fp(502, [1, 2.03, 3.16], [1.02, 0.77, 0.56])]);
    const glassBell = model("glass-bell", [fp(600, [1, 2.45, 4.1], [1.8, 1.3, 1.0]), fp(602, [1, 2.44, 4.08], [1.75, 1.28, 0.98])]);
    const glassBowl = model("glass-bowl", [fp(670, [1, 2.48, 4.12], [1.7, 1.25, 0.95]), fp(672, [1, 2.47, 4.11], [1.72, 1.27, 0.96])]);
    const inferred = createMaterialAssertion({
      materialLabel: "plastic",
      source: "inferred",
      sourceReference: null,
      confidenceClass: "inferred",
      algorithmDerivationId: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    });
    const examples = [
      {
        exampleId: "mbell",
        specimenId: "metal-bell",
        objectFamily: "bell",
        assertion: createMaterialAssertion({ materialLabel: "metal", source: "inspection", sourceReference: "lab", confidenceClass: "verified", algorithmDerivationId: null }),
        model: metalBell,
      },
      {
        exampleId: "mbowl",
        specimenId: "metal-bowl",
        objectFamily: "bowl",
        assertion: createMaterialAssertion({ materialLabel: "metal", source: "expert", sourceReference: "curator", confidenceClass: "verified", algorithmDerivationId: null }),
        model: metalBowl,
      },
      {
        exampleId: "gbell",
        specimenId: "glass-bell",
        objectFamily: "bell",
        assertion: createMaterialAssertion({ materialLabel: "glass", source: "manufacturer", sourceReference: "catalog", confidenceClass: "verified", algorithmDerivationId: null }),
        model: glassBell,
      },
      {
        exampleId: "gbowl",
        specimenId: "glass-bowl",
        objectFamily: "bowl",
        assertion: createMaterialAssertion({ materialLabel: "glass", source: "inspection", sourceReference: "lab", confidenceClass: "verified", algorithmDerivationId: null }),
        model: glassBowl,
      },
      {
        exampleId: "inferred-skip",
        specimenId: "plastic-cup",
        objectFamily: "cup",
        assertion: inferred,
        model: metalBell,
      },
    ];
    expect(materialExamplesEligibleForTraining(examples)).toHaveLength(4);
    const evaluation = fitAndBenchmarkMaterialFamilyDisjoint(
      examples,
      "digital-family-disjoint-1",
      0,
      (family) => family === "bell" ? "train" : "test",
    );
    expect(evaluation.evidenceEligible).toBe(false);
    expect(evaluation.trainFamilyCount).toBe(1);
    expect(evaluation.evaluationFamilyCount).toBe(1);
    expect(evaluation.metrics.coverage).toBeGreaterThan(0);
    expect(evaluation.metrics.macroF1).not.toBeNull();
    expect(evaluation.metrics.balancedAccuracy).not.toBeNull();
    expect(evaluation.metrics.perClass.length).toBeGreaterThanOrEqual(2);
  });
});
