import { describe, expect, it } from "vitest";
import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import {
  buildAcousticObjectModel,
  buildSonicTwinIndex,
  buildTwinVerificationPairs,
  characterizeNuisance,
  selectHardNegativePairs,
  type AcousticObjectObservationV1,
  type NuisanceMetadataV1,
  type TwinBenchmarkCorpusV1,
} from "../src";

function fingerprint(frequencies: readonly number[]): AcousticFingerprintV1 {
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
      diagnostics: {
        prominenceDb: 20,
        persistenceSeconds: 0.2,
        frequencyStdCents: 2,
        decayFitScore: 0.95,
        observationCount: 12,
      },
    })),
  };
}

const nuisance: NuisanceMetadataV1 = {
  strikeLocation: "A",
  striker: "wood",
  support: "felt",
  microphoneDistanceClass: "20cm",
  room: "room-1",
  stationId: "station-1",
  operatorId: "operator-1",
  dayId: "day-1",
};

const observations: readonly AcousticObjectObservationV1[] = [
  { observationId: "a-3", specimenId: "Specimen-A", fingerprint: fingerprint([442, 884, 1326]) },
  { observationId: "a-1", specimenId: "specimen-a", fingerprint: fingerprint([440, 880, 1320]) },
  { observationId: "a-2", specimenId: "SPECIMEN-A", fingerprint: fingerprint([441, 882, 1323]) },
  { observationId: "b-2", specimenId: "specimen-b", fingerprint: fingerprint([611, 1222, 1833]) },
  { observationId: "b-1", specimenId: "specimen-b", fingerprint: fingerprint([610, 1220, 1830]) },
  { observationId: "c-2", specimenId: "specimen-c", fingerprint: fingerprint([443, 886, 1329]) },
  { observationId: "c-1", specimenId: "specimen-c", fingerprint: fingerprint([442.5, 885, 1328]) },
];

function reversed<T>(values: readonly T[]): T[] {
  return [...values].reverse();
}

describe("research reproducibility contracts", () => {
  it("builds byte-equivalent object models from any observation order", () => {
    const specimen = observations.filter((observation) => observation.specimenId.toLocaleLowerCase("en-US") === "specimen-a");
    const forward = buildAcousticObjectModel(specimen);
    const reverse = buildAcousticObjectModel(reversed(specimen));
    expect(reverse).toEqual(forward);
    expect(forward.specimenId).toBe("specimen-a");
    expect(forward.modes.every((mode) => [...mode.sourceObservationIds].join(",") === [...mode.sourceObservationIds].sort().join(","))).toBe(true);
  });

  it("builds the same Sonic Twin index from a permuted observation set", () => {
    expect(buildSonicTwinIndex(reversed(observations))).toEqual(buildSonicTwinIndex(observations));
  });

  it("makes nuisance pairs and hard-negative selection invariant to input order", () => {
    const labeled = observations.map((observation, index) => ({
      ...observation,
      nuisance: { ...nuisance, strikeLocation: index % 2 === 0 ? "A" : "B" },
    }));
    expect(characterizeNuisance(reversed(labeled))).toEqual(characterizeNuisance(labeled));
    expect(selectHardNegativePairs(reversed(labeled), 5)).toEqual(selectHardNegativePairs(labeled, 5));
  });

  it("constructs identical benchmark verification pairs after corpus permutation", () => {
    const benchmarkObservations = observations.map((observation, index) => ({
      ...observation,
      objectFamily: observation.specimenId.toLocaleLowerCase("en-US").includes("b") ? "bowl" : "bell",
      source: "digital-twin" as const,
      nuisance: { ...nuisance, strikeLocation: index % 2 === 0 ? "A" : "B" },
    }));
    const forward: TwinBenchmarkCorpusV1 = {
      schemaVersion: 1,
      corpusContractVersion: "sonic-twin-benchmark-corpus-1",
      corpusId: "permutation-regression",
      createdAt: "2026-08-25T00:00:00.000Z",
      observations: benchmarkObservations,
    };
    const reverse: TwinBenchmarkCorpusV1 = { ...forward, observations: reversed(benchmarkObservations) };
    expect(buildTwinVerificationPairs(reverse, 20)).toEqual(buildTwinVerificationPairs(forward, 20));
  });

  it("rejects duplicate nuisance observation identifiers before pair selection", () => {
    const duplicate = [
      { observationId: "duplicate", specimenId: "a", fingerprint: fingerprint([440, 880, 1320]), nuisance },
      { observationId: "duplicate", specimenId: "b", fingerprint: fingerprint([441, 882, 1323]), nuisance },
    ];
    expect(() => selectHardNegativePairs(duplicate, 1)).toThrow(/duplicate nuisance observationId/);
  });
});
