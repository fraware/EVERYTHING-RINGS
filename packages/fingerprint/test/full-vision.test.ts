import { describe, expect, it } from "vitest";
import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import {
  benchmarkSonicTwinRetrieval,
  buildAcousticObjectModel,
  buildSonicTwinIndex,
  buildTwinVerificationPairs,
  calibratedPredictions,
  compareFingerprintToObjectModel,
  evaluateCalibration,
  fitIsotonicCalibration,
  predictCalibratedProbability,
  retrieveSonicTwin,
  riskCoverageCurve,
  validateTwinBenchmarkCorpus,
  type AcousticObjectObservationV1,
  type NuisanceMetadataV1,
  type TwinBenchmarkCorpusV1,
} from "../src";

function fp(frequencies: readonly number[], amplitudeScale = 1, decayScale = 1): AcousticFingerprintV1 {
  return {
    version: 1,
    algorithmVersion: "er-dsp-2",
    sampleRate: 48_000,
    durationSeconds: 2,
    modes: frequencies.map((frequencyHz, index) => ({
      frequencyHz,
      relativeAmplitude: amplitudeScale / (index + 1),
      decaySeconds: decayScale * 0.9 / (index + 1),
      q: 100,
      confidence: 0.9,
      diagnostics: { prominenceDb: 20, persistenceSeconds: 0.2, frequencyStdCents: 2, decayFitScore: 0.95, observationCount: 12 },
    })),
  };
}

function observations(): AcousticObjectObservationV1[] {
  return [
    { observationId: "a-1", specimenId: "specimen-a", fingerprint: fp([440, 880, 1320]) },
    { observationId: "a-2", specimenId: "specimen-a", fingerprint: fp([441, 881.5, 1322]) },
    { observationId: "b-1", specimenId: "specimen-b", fingerprint: fp([610, 1220, 1830]) },
    { observationId: "b-2", specimenId: "specimen-b", fingerprint: fp([611, 1221, 1832]) },
    { observationId: "c-1", specimenId: "specimen-c", fingerprint: fp([442, 884, 1326]) },
    { observationId: "c-2", specimenId: "specimen-c", fingerprint: fp([443, 885, 1329]) },
  ];
}

const nuisance: NuisanceMetadataV1 = {
  strikeLocation: "A",
  striker: "wood",
  support: "felt",
  microphoneDistanceClass: "20cm",
  room: "digital-room",
  stationId: "digital-station",
  operatorId: "digital-operator",
  dayId: "day-1",
};

describe("full-vision Sonic Twin infrastructure", () => {
  it("aggregates repeated observations into an uncertainty-preserving object model", () => {
    const model = buildAcousticObjectModel(observations().filter((observation) => observation.specimenId === "specimen-a"));
    expect(model.specimenId).toBe("specimen-a");
    expect(model.observationCount).toBe(2);
    expect(model.modes).toHaveLength(3);
    expect(model.modes.every((mode) => mode.observationSupportFraction === 1)).toBe(true);
    expect(model.modes[0]!.frequencyHzMedian).toBeGreaterThan(440);
    expect(model.modes[0]!.frequencyHzMedian).toBeLessThan(441.1);
    expect(model.modes[0]!.frequencyMadCents).toBeGreaterThanOrEqual(0);

    const same = compareFingerprintToObjectModel(fp([440.5, 880.5, 1321]), model);
    const different = compareFingerprintToObjectModel(fp([610, 1220, 1830]), model);
    expect(same.evidenceScore).toBeGreaterThan(different.evidenceScore);
    expect(same.coverage).toBe(1);
  });

  it("retrieves a query against specimen-level object models and reports ranking metrics", () => {
    const index = buildSonicTwinIndex(observations());
    expect(index.entries).toHaveLength(3);
    const ranked = retrieveSonicTwin(fp([440.8, 881, 1321.5]), index);
    expect(ranked[0]?.specimenId).toBe("specimen-a");
    expect(ranked[0]?.rank).toBe(1);

    const metrics = benchmarkSonicTwinRetrieval([
      { queryId: "qa", trueSpecimenId: "specimen-a", fingerprint: fp([440.7, 881, 1321]) },
      { queryId: "qb", trueSpecimenId: "specimen-b", fingerprint: fp([610.5, 1220.5, 1831]) },
    ], index);
    expect(metrics.recallAt1).toBe(1);
    expect(metrics.meanReciprocalRank).toBe(1);
    expect(metrics.missingTrueSpecimenCount).toBe(0);
  });

  it("validates a provenance-aware specimen-disjoint benchmark corpus and constructs labeled pairs", () => {
    const data = observations();
    const corpus: TwinBenchmarkCorpusV1 = {
      schemaVersion: 1,
      corpusContractVersion: "sonic-twin-benchmark-corpus-1",
      corpusId: "digital-full-vision-corpus-1",
      createdAt: "2026-08-24T15:30:00.000Z",
      observations: data.map((observation, index) => ({
        ...observation,
        objectFamily: observation.specimenId === "specimen-b" ? "bowl" : "bell",
        source: "digital-twin" as const,
        nuisance: { ...nuisance, strikeLocation: index % 2 === 0 ? "A" : "B" },
      })),
    };
    const validation = validateTwinBenchmarkCorpus(corpus);
    expect(validation.valid).toBe(true);
    expect(validation.specimenCount).toBe(3);
    expect(validation.sourceCounts["digital-twin"]).toBe(6);

    const pairs = buildTwinVerificationPairs(corpus, 20);
    expect(pairs.some((pair) => pair.samePhysicalSpecimen)).toBe(true);
    expect(pairs.every((pair) => pair.split === pairs.find((candidate) => candidate.pairId === pair.pairId)?.split)).toBe(true);
    for (const pair of pairs) {
      if (pair.samePhysicalSpecimen) expect(pair.leftSpecimenId).toBe(pair.rightSpecimenId);
      else expect(pair.leftSpecimenId).not.toBe(pair.rightSpecimenId);
    }
  });

  it("fits a data-bound monotonic calibration model and reports calibration/risk metrics", () => {
    const training = [
      { pairId: "n1", score: 0.05, samePhysicalSpecimen: false },
      { pairId: "n2", score: 0.15, samePhysicalSpecimen: false },
      { pairId: "n3", score: 0.35, samePhysicalSpecimen: false },
      { pairId: "p1", score: 0.65, samePhysicalSpecimen: true },
      { pairId: "p2", score: 0.85, samePhysicalSpecimen: true },
      { pairId: "p3", score: 0.95, samePhysicalSpecimen: true },
    ];
    const model = fitIsotonicCalibration(training, "digital-twin-corpus-1");
    expect(model.trainingSampleCount).toBe(6);
    expect(predictCalibratedProbability(model, 0.9)).toBeGreaterThan(predictCalibratedProbability(model, 0.1));
    for (let index = 1; index < model.bins.length; index += 1) {
      expect(model.bins[index]!.probability).toBeGreaterThanOrEqual(model.bins[index - 1]!.probability);
    }

    const predictions = calibratedPredictions(model, training);
    const metrics = evaluateCalibration(predictions, 5);
    expect(metrics.brierScore).not.toBeNull();
    expect(metrics.rocAuc).toBe(1);
    const curve = riskCoverageCurve(predictions, [0, 0.25, 0.49]);
    expect(curve).toHaveLength(3);
    expect(curve[0]!.coverage).toBe(1);
    expect(curve[2]!.coverage).toBeLessThanOrEqual(curve[0]!.coverage);
  });
});
