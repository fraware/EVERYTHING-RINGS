import { describe, expect, it } from "vitest";
import { assessCaptureQuality, type AudioCapture } from "@everything-rings/acquisition";
import { analyzeImpact, extractImpactRingdown, type AcousticFingerprintV1 } from "@everything-rings/dsp";
import {
  benchmarkSonicTwinRetrieval,
  buildAcousticObjectModel,
  buildSonicTwinIndex,
  compareFingerprintToObjectModel,
  fitAndEvaluateHeldOutCalibration,
  type AcousticObjectObservationV1,
  type PartitionedSimilarityScoreV1,
} from "@everything-rings/fingerprint";
import { renderPlayableNote } from "@everything-rings/instrument";
import {
  buildAtlasGraph,
  contentDigest,
  createAtlasCollection,
  createAtlasRecord,
  createDerivationRecord,
  createMeasurementRecord,
  createStationCalibrationProtocol,
  emptyResearchRepository,
  evaluateVerifiedStationCalibration,
  ingestDerivation,
  ingestMeasurement,
  publishRepositoryAtlasRecord,
  searchAtlas,
  snapshotAtlasRegistry,
  verifyResearchRepositoryIntegrity,
} from "@everything-rings/validation";

const SAMPLE_RATE = 48_000;
const REVISION = "0123456789abcdef0123456789abcdef01234567";

interface DigitalSpecimen {
  readonly id: string;
  readonly baseModes: readonly { f: number; tau: number; a: number }[];
}

const SPECIMENS: readonly DigitalSpecimen[] = [
  { id: "twin-bell-a", baseModes: [{ f: 431, tau: 1.1, a: 0.20 }, { f: 907, tau: 0.9, a: 0.14 }, { f: 1499, tau: 0.7, a: 0.10 }, { f: 2281, tau: 0.55, a: 0.07 }] },
  { id: "twin-bell-b", baseModes: [{ f: 472, tau: 1.0, a: 0.19 }, { f: 936, tau: 0.8, a: 0.13 }, { f: 1448, tau: 0.65, a: 0.09 }, { f: 2197, tau: 0.50, a: 0.06 }] },
  { id: "twin-plate-c", baseModes: [{ f: 613, tau: 0.8, a: 0.18 }, { f: 1033, tau: 0.65, a: 0.12 }, { f: 1717, tau: 0.5, a: 0.08 }, { f: 2811, tau: 0.4, a: 0.05 }] },
];

function pseudoRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(1664525, state) + 1013904223 >>> 0;
    return state / 0x1_0000_0000;
  };
}

function captureFor(specimen: DigitalSpecimen, replicate: number): AudioCapture {
  const triggerSample = Math.round(0.15 * SAMPLE_RATE);
  const samples = new Float32Array(Math.round(2.4 * SAMPLE_RATE));
  const random = pseudoRandom(1000 + replicate * 31 + specimen.id.length * 17);
  const frequencyScale = 1 + (replicate - 1) * 0.0007;
  const decayScale = 1 + (replicate - 1) * 0.025;
  const amplitudeScale = 1 - (replicate - 1) * 0.04;
  for (let index = 0; index < samples.length; index += 1) {
    const noise = (2 * random() - 1) * 0.00018;
    if (index < triggerSample) {
      samples[index] = noise;
      continue;
    }
    const t = (index - triggerSample) / SAMPLE_RATE;
    let value = noise;
    specimen.baseModes.forEach((mode, modeIndex) => {
      value += mode.a * amplitudeScale * Math.exp(-t / (mode.tau * decayScale))
        * Math.sin(2 * Math.PI * mode.f * frequencyScale * t + 0.35 * modeIndex + replicate * 0.07);
    });
    samples[index] = Math.max(-0.95, Math.min(0.95, value));
  }
  return { samples, sampleRate: SAMPLE_RATE, triggerSample };
}

function fingerprintFromCapture(capture: AudioCapture): AcousticFingerprintV1 {
  const quality = assessCaptureQuality(capture);
  expect(quality.ok).toBe(true);
  const ringdown = extractImpactRingdown(capture.samples, capture.sampleRate, capture.triggerSample);
  const result = analyzeImpact(ringdown.samples, ringdown.sampleRate);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  expect(result.fingerprint.modes.length).toBeGreaterThanOrEqual(3);
  return result.fingerprint;
}

function peak(samples: Float32Array): number {
  let maximum = 0;
  for (const value of samples) maximum = Math.max(maximum, Math.abs(value));
  return maximum;
}

describe("EVERYTHING RINGS full-vision software system", () => {
  it("qualifies digital capture through held-out calibration, station checks, provenance, Atlas, graph, and playable output", async () => {
    const observations: AcousticObjectObservationV1[] = [];
    for (const specimen of SPECIMENS) {
      for (let replicate = 0; replicate < 3; replicate += 1) {
        observations.push({
          observationId: `${specimen.id}-r${replicate + 1}`,
          specimenId: specimen.id,
          fingerprint: fingerprintFromCapture(captureFor(specimen, replicate)),
        });
      }
    }

    const index = buildSonicTwinIndex(observations);
    expect(index.entries).toHaveLength(3);
    const heldOutQueries = SPECIMENS.map((specimen, indexValue) => ({
      queryId: `heldout-${specimen.id}`,
      trueSpecimenId: specimen.id,
      fingerprint: fingerprintFromCapture(captureFor(specimen, 4 + indexValue)),
    }));
    const retrieval = benchmarkSonicTwinRetrieval(heldOutQueries, index);
    expect(retrieval.recallAt1).toBe(1);
    expect(retrieval.meanReciprocalRank).toBe(1);

    const labeledScores: PartitionedSimilarityScoreV1[] = heldOutQueries.flatMap((query, queryIndex) => index.entries.map((entry) => {
      const comparison = compareFingerprintToObjectModel(query.fingerprint, entry.model);
      return {
        pairId: `${query.queryId}::${entry.specimenId}`,
        groupId: query.trueSpecimenId,
        partition: queryIndex < 2 ? "calibration" as const : "evaluation" as const,
        score: comparison.evidenceScore,
        samePhysicalSpecimen: query.trueSpecimenId === entry.specimenId,
      };
    }));
    const calibration = fitAndEvaluateHeldOutCalibration(
      labeledScores,
      "full-vision-digital-calibration-population-1",
      "full-vision-digital-held-out-population-1",
      5,
      [0, 0.2, 0.4],
    );
    expect(calibration.calibrationGroups).toHaveLength(2);
    expect(calibration.evaluationGroups).toHaveLength(1);
    expect(calibration.metrics.rocAuc).not.toBeNull();
    expect(calibration.metrics.rocAuc!).toBeGreaterThan(0.9);
    expect(calibration.riskCoverage[0]?.coverage).toBe(1);

    const referenceModel = buildAcousticObjectModel(observations.filter((observation) => observation.specimenId === SPECIMENS[0]!.id));
    const stationProtocol = await createStationCalibrationProtocol({
      createdAt: "2026-08-24T16:00:00.000Z",
      referencePopulation: "full-vision-digital-reference-1",
      referenceSpecimenId: SPECIMENS[0]!.id,
      referenceObjectModel: referenceModel,
      minimumCoverage: 0.75,
      maximumMedianFrequencyDistanceCents: 45,
      minimumMatchedModes: 3,
    });
    const stationVerdict = await evaluateVerifiedStationCalibration(stationProtocol, {
      stationId: "digital-station-system-test",
      createdAt: "2026-08-24T16:01:00.000Z",
      specimenId: SPECIMENS[0]!.id,
      fingerprint: heldOutQueries[0]!.fingerprint,
    });
    expect(stationVerdict.passed).toBe(true);

    let repository = emptyResearchRepository();
    const atlasRecordIds: string[] = [];
    for (let indexValue = 0; indexValue < heldOutQueries.length; indexValue += 1) {
      const query = heldOutQueries[indexValue]!;
      const measurement = await createMeasurementRecord({
        createdAt: `2026-08-24T16:1${indexValue}:00.000Z`,
        specimenId: query.trueSpecimenId,
        sessionId: `system-session-${indexValue + 1}`,
        attemptId: 1,
        material: "other",
        acquisitionContractVersion: "full-vision-digital-capture-1",
        softwareRevision: REVISION,
        fingerprintAlgorithmVersion: query.fingerprint.algorithmVersion,
        setup: { fixedSetup: true, microphoneDistanceCm: 20, striker: "digital impulse", strikeLocation: "digital A", supportCondition: "digital fixed" },
        station: { stationId: "digital-station-system-test", deviceDescription: "deterministic software twin", operatingSystem: "ci", runtime: "vitest", microphoneDescription: null, captureSettings: { sampleRate: SAMPLE_RATE, channelCount: 1 } },
        fingerprint: query.fingerprint,
      });
      repository = await ingestMeasurement(repository, measurement);
      const derivation = await createDerivationRecord({
        measurementId: measurement.measurementId,
        kind: "similarity",
        algorithmVersion: "acoustic-object-model-1+sonic-twin-index-1",
        configDigest: await contentDigest({ stationProtocol: stationProtocol.protocolId, calibration: calibration.model.trainingPopulation }),
        artifactDigest: await contentDigest({ ranking: index.entries.map((entry) => compareFingerprintToObjectModel(query.fingerprint, entry.model)) }),
        createdAt: `2026-08-24T16:2${indexValue}:00.000Z`,
      });
      repository = await ingestDerivation(repository, derivation);
      const atlas = await createAtlasRecord({
        createdAt: `2026-08-24T16:3${indexValue}:00.000Z`,
        contributor: { contributorId: "digital-system", displayName: "Full-vision software qualification" },
        specimen: { specimenId: query.trueSpecimenId, label: query.trueSpecimenId, objectFamily: query.trueSpecimenId.includes("plate") ? "plate" : "bell", material: "other", publicDescription: "Synthetic full-vision system record" },
        measurements: [{ measurementId: measurement.measurementId, derivationIds: [derivation.derivationId] }],
      });
      repository = await publishRepositoryAtlasRecord(repository, atlas);
      atlasRecordIds.push(atlas.atlasRecordId);

      const playable = renderPlayableNote(query.fingerprint, 60 + indexValue * 7, SAMPLE_RATE);
      expect(playable.samples.length).toBeGreaterThan(0);
      expect(peak(playable.samples)).toBeLessThanOrEqual(0.90001);
    }

    const integrity = await verifyResearchRepositoryIntegrity(repository);
    expect(integrity.valid).toBe(true);
    expect(searchAtlas(repository.atlas, { text: "twin" }).length).toBeGreaterThanOrEqual(2);
    const collection = await createAtlasCollection({
      createdAt: "2026-08-24T16:40:00.000Z",
      contributorId: "digital-system",
      title: "Full-vision digital resonators",
      description: "Software qualification collection",
      atlasRecordIds,
    });
    const graph = await buildAtlasGraph(repository.atlas, [collection]);
    expect(graph.nodes.some((node) => node.kind === "collection")).toBe(true);
    expect(graph.edges.filter((edge) => edge.kind === "member-of")).toHaveLength(3);
    expect(graph.edges.filter((edge) => edge.kind === "created-by")).toHaveLength(1);
    const snapshot = await snapshotAtlasRegistry(repository.atlas, "2026-08-24T16:41:00.000Z");
    expect(snapshot.recordIds).toHaveLength(3);
  });
});
