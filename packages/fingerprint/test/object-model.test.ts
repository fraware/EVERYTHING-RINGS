import { describe, expect, it } from "vitest";
import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import {
  assessAcousticObjectModelQuality,
  buildAcousticObjectModel,
  buildAcousticObjectModelV2,
  compareFingerprintToObjectModel,
} from "../src";

function fingerprint(frequencies: readonly number[], algorithmVersion: AcousticFingerprintV1["algorithmVersion"] = "er-dsp-2"): AcousticFingerprintV1 {
  return {
    version: 1,
    algorithmVersion,
    sampleRate: 48_000,
    durationSeconds: 2,
    modes: frequencies.map((frequencyHz, index) => ({
      frequencyHz,
      relativeAmplitude: 1 / (index + 1),
      decaySeconds: 0.9 / (index + 1),
      q: 100,
      confidence: 0.9,
      diagnostics: { prominenceDb: 20, persistenceSeconds: 0.2, frequencyStdCents: 2, decayFitScore: 0.95, observationCount: 12 },
    })),
  };
}

describe("acoustic object-model hardening", () => {
  it("keeps AcousticObjectModelV1 shape frozen for content addressing", () => {
    const model = buildAcousticObjectModel([
      { observationId: "a-1", specimenId: "specimen-a", fingerprint: fingerprint([440, 880, 1320]) },
      { observationId: "a-2", specimenId: "specimen-a", fingerprint: fingerprint([441, 881, 1322]) },
    ]);
    expect(Object.keys(model).sort()).toEqual([
      "fingerprintAlgorithmVersions",
      "modes",
      "objectModelVersion",
      "observationCount",
      "sampleRates",
      "schemaVersion",
      "specimenId",
    ]);
    expect(model.objectModelVersion).toBe("acoustic-object-model-1");
    expect(model.schemaVersion).toBe(1);
    expect(model.fingerprintAlgorithmVersions).toEqual(["er-dsp-2"]);
    expect(model.modes[0] && Object.keys(model.modes[0]).sort()).toEqual([
      "decayLogMad",
      "decaySecondsMedian",
      "frequencyHzMedian",
      "frequencyMadCents",
      "observationSupportCount",
      "observationSupportFraction",
      "relativeAmplitudeDbMad",
      "relativeAmplitudeMedian",
      "sourceObservationIds",
    ]);
  });

  it("refuses to mix fingerprint algorithm versions", () => {
    expect(() => buildAcousticObjectModel([
      { observationId: "a-1", specimenId: "specimen-a", fingerprint: fingerprint([440, 880, 1320], "er-dsp-2") },
      { observationId: "a-2", specimenId: "specimen-a", fingerprint: fingerprint([441, 881, 1322], "er-dsp-1") },
    ])).toThrow(/cannot mix fingerprint algorithm versions/);
  });

  it("records source measurement IDs and quality diagnostics only on AcousticObjectModelV2", () => {
    const v2 = buildAcousticObjectModelV2([
      {
        observationId: "a-1",
        specimenId: "specimen-a",
        measurementId: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        fingerprint: fingerprint([440, 880, 1320]),
      },
      {
        observationId: "a-2",
        specimenId: "specimen-a",
        measurementId: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        fingerprint: fingerprint([441, 881, 1322]),
      },
    ]);
    expect(v2.objectModelVersion).toBe("acoustic-object-model-2");
    expect(v2.schemaVersion).toBe(2);
    expect(v2.fingerprintAlgorithmVersion).toBe("er-dsp-2");
    expect(v2.sourceObservationIds).toEqual(["a-1", "a-2"]);
    expect(v2.sourceMeasurementIds).toHaveLength(2);
    expect(v2.quality.productEligible).toBe(false);
    expect(v2.quality.homogeneousAlgorithmVersion).toBe(true);
    expect(v2.quality.minimumSupportSatisfied).toBe(true);
    expect(v2.quality.sourceMeasurementIdCount).toBe(2);
    expect(v2.modes.every((mode) => typeof mode.belowRecommendedSupport === "boolean")).toBe(true);
    expect(v2.modes.every((mode) => mode.observationSupportCount === 2)).toBe(true);

    const comparison = compareFingerprintToObjectModel(fingerprint([440.5, 880.5, 1321]), v2);
    expect(comparison.coverage).toBe(1);
    expect(comparison.evidenceScore).toBeGreaterThan(0.5);
  });

  it("warns when measurement provenance or repeated-observation support is missing", () => {
    const sparse = buildAcousticObjectModel([
      { observationId: "only", specimenId: "specimen-sparse", fingerprint: fingerprint([440, 880, 1320]) },
    ]);
    const quality = assessAcousticObjectModelQuality(sparse);
    expect(quality.productEligible).toBe(false);
    expect(quality.minimumSupportSatisfied).toBe(false);
    expect(quality.warnings.some((warning) => warning.includes("source measurement IDs are absent"))).toBe(true);
    expect(quality.warnings.some((warning) => warning.includes("repeated-observation support"))).toBe(true);
  });
});
