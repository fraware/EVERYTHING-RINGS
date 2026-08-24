import { describe, expect, it } from "vitest";
import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { buildAcousticObjectModel } from "@everything-rings/fingerprint";
import { createStationCalibrationProtocol, evaluateStationCalibration } from "../src";

function fp(frequencies: readonly number[]): AcousticFingerprintV1 {
  return {
    version: 1,
    algorithmVersion: "er-dsp-2",
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

describe("measurement-station calibration", () => {
  it("passes a digital station observation close to its frozen reference object model", async () => {
    const model = buildAcousticObjectModel([
      { observationId: "r1", specimenId: "reference-1", fingerprint: fp([440, 880, 1320]) },
      { observationId: "r2", specimenId: "reference-1", fingerprint: fp([441, 882, 1323]) },
    ]);
    const protocol = await createStationCalibrationProtocol({
      createdAt: "2026-08-24T15:30:00.000Z",
      referencePopulation: "digital-station-reference-v1",
      referenceSpecimenId: "reference-1",
      referenceObjectModel: model,
      minimumCoverage: 1,
      maximumMedianFrequencyDistanceCents: 35,
      minimumMatchedModes: 3,
    });
    const verdict = evaluateStationCalibration(protocol, {
      stationId: "station-digital-a",
      createdAt: "2026-08-24T15:31:00.000Z",
      specimenId: "reference-1",
      fingerprint: fp([440.5, 881, 1321.5]),
    });
    expect(verdict.passed).toBe(true);
    expect(verdict.comparison.coverage).toBe(1);
  });

  it("fails a digital station observation that drifts outside its frozen contract", async () => {
    const model = buildAcousticObjectModel([
      { observationId: "r1", specimenId: "reference-1", fingerprint: fp([440, 880, 1320]) },
      { observationId: "r2", specimenId: "reference-1", fingerprint: fp([441, 882, 1323]) },
    ]);
    const protocol = await createStationCalibrationProtocol({
      createdAt: "2026-08-24T15:30:00.000Z",
      referencePopulation: "digital-station-reference-v1",
      referenceSpecimenId: "reference-1",
      referenceObjectModel: model,
      minimumCoverage: 1,
      maximumMedianFrequencyDistanceCents: 35,
      minimumMatchedModes: 3,
    });
    const verdict = evaluateStationCalibration(protocol, {
      stationId: "station-digital-b",
      createdAt: "2026-08-24T15:31:00.000Z",
      specimenId: "reference-1",
      fingerprint: fp([500, 1000, 1500]),
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.length).toBeGreaterThan(0);
  });
});
