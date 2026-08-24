import { describe, expect, it } from "vitest";
import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import {
  characterizeNuisance,
  selectHardNegativePairs,
  specimenDisjointSplit,
  type LabeledFingerprintObservationV1,
  type NuisanceMetadataV1,
} from "../src";

function fp(frequencies: readonly number[]): AcousticFingerprintV1 {
  return {
    version: 1,
    algorithmVersion: "er-dsp-2",
    sampleRate: 48_000,
    durationSeconds: 2,
    modes: frequencies.map((frequencyHz, index) => ({
      frequencyHz,
      relativeAmplitude: 1 / (index + 1),
      decaySeconds: 0.8 / (index + 1),
      q: 100,
      confidence: 0.9,
      diagnostics: { prominenceDb: 20, persistenceSeconds: 0.2, frequencyStdCents: 2, decayFitScore: 0.95, observationCount: 12 },
    })),
  };
}

const baseNuisance: NuisanceMetadataV1 = {
  strikeLocation: "A",
  striker: "wood",
  support: "felt",
  microphoneDistanceClass: "20cm",
  room: "room-1",
  stationId: "station-1",
  operatorId: "operator-1",
  dayId: "day-1",
};

function observation(id: string, specimenId: string, frequencies: readonly number[], nuisance: NuisanceMetadataV1): LabeledFingerprintObservationV1 {
  return { observationId: id, specimenId, fingerprint: fp(frequencies), nuisance };
}

describe("Sonic Twin nuisance benchmark utilities", () => {
  it("isolates one-factor repeated-measurement drift", () => {
    const data = [
      observation("a1", "specimen-a", [440, 880, 1320], baseNuisance),
      observation("a2", "specimen-a", [441, 882, 1323], { ...baseNuisance, strikeLocation: "B" }),
      observation("a3", "specimen-a", [442, 884, 1326], { ...baseNuisance, stationId: "station-2" }),
    ];
    const report = characterizeNuisance(data);
    expect(report.specimenCount).toBe(1);
    expect(report.withinSpecimenPairs).toHaveLength(3);
    expect(report.factorSummaries.find((summary) => summary.factor === "strikeLocation")?.comparisonCount).toBe(1);
    expect(report.factorSummaries.find((summary) => summary.factor === "stationId")?.comparisonCount).toBe(1);
  });

  it("selects the acoustically closest different-specimen observations as hard negatives", () => {
    const data = [
      observation("a", "specimen-a", [440, 880, 1320], baseNuisance),
      observation("b", "specimen-b", [441, 882, 1323], baseNuisance),
      observation("c", "specimen-c", [600, 1200, 1800], baseNuisance),
    ];
    const hard = selectHardNegativePairs(data, 1);
    expect(hard).toHaveLength(1);
    expect(new Set([hard[0]?.leftSpecimenId, hard[0]?.rightSpecimenId])).toEqual(new Set(["specimen-a", "specimen-b"]));
  });

  it("assigns every capture of a specimen to the same deterministic benchmark split", () => {
    const first = specimenDisjointSplit("Specimen-001");
    expect(first).toBe(specimenDisjointSplit(" specimen-001 "));
    expect(["train", "validation", "test"]).toContain(first);
  });
});
