import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { centsDistance } from "./recurrence";

export interface AcousticObjectObservationV1 {
  readonly observationId: string;
  readonly specimenId: string;
  readonly fingerprint: AcousticFingerprintV1;
}

export interface AcousticObjectModelConfigV1 {
  readonly clusteringToleranceCents: number;
  readonly minimumObservationSupportFraction: number;
  readonly minimumObservationSupportCount: number;
}

export const DEFAULT_ACOUSTIC_OBJECT_MODEL_CONFIG: AcousticObjectModelConfigV1 = {
  clusteringToleranceCents: 80,
  minimumObservationSupportFraction: 0.5,
  minimumObservationSupportCount: 2,
};

export interface AcousticObjectModeEstimateV1 {
  readonly frequencyHzMedian: number;
  readonly frequencyMadCents: number;
  readonly decaySecondsMedian: number;
  readonly decayLogMad: number;
  readonly relativeAmplitudeMedian: number;
  readonly relativeAmplitudeDbMad: number;
  readonly observationSupportCount: number;
  readonly observationSupportFraction: number;
  readonly sourceObservationIds: readonly string[];
}

export interface AcousticObjectModelV1 {
  readonly schemaVersion: 1;
  readonly objectModelVersion: "acoustic-object-model-1";
  readonly specimenId: string;
  readonly observationCount: number;
  readonly fingerprintAlgorithmVersions: readonly string[];
  readonly sampleRates: readonly number[];
  readonly modes: readonly AcousticObjectModeEstimateV1[];
}

interface ModeSample {
  readonly observationId: string;
  readonly frequencyHz: number;
  readonly decaySeconds: number;
  readonly relativeAmplitude: number;
}

interface MutableCluster {
  readonly samples: ModeSample[];
}

function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error("median requires at least one value");
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle]!;
  return (ordered[middle - 1]! + ordered[middle]!) / 2;
}

function medianAbsoluteDeviation(values: readonly number[]): number {
  const center = median(values);
  return median(values.map((value) => Math.abs(value - center)));
}

function dbAmplitude(value: number): number {
  return 20 * Math.log10(Math.max(value, 1e-9));
}

function clusterCenterFrequency(cluster: MutableCluster): number {
  return median(cluster.samples.map((sample) => sample.frequencyHz));
}

function validateConfig(config: AcousticObjectModelConfigV1): void {
  if (!(config.clusteringToleranceCents > 0) || !Number.isFinite(config.clusteringToleranceCents)) {
    throw new Error("object-model clusteringToleranceCents must be finite and positive");
  }
  if (!(config.minimumObservationSupportFraction > 0 && config.minimumObservationSupportFraction <= 1)) {
    throw new Error("object-model minimumObservationSupportFraction must be in (0, 1]");
  }
  if (!Number.isInteger(config.minimumObservationSupportCount) || config.minimumObservationSupportCount <= 0) {
    throw new Error("object-model minimumObservationSupportCount must be a positive integer");
  }
}

export function buildAcousticObjectModel(
  observations: readonly AcousticObjectObservationV1[],
  config: AcousticObjectModelConfigV1 = DEFAULT_ACOUSTIC_OBJECT_MODEL_CONFIG,
): AcousticObjectModelV1 {
  validateConfig(config);
  if (observations.length === 0) throw new Error("object model requires at least one observation");
  const specimenId = observations[0]!.specimenId.trim();
  if (specimenId.length === 0) throw new Error("object model specimenId is required");
  const normalized = specimenId.toLocaleLowerCase("en-US");
  if (observations.some((observation) => observation.specimenId.trim().toLocaleLowerCase("en-US") !== normalized)) {
    throw new Error("object model cannot mix different specimen IDs");
  }
  const observationIds = new Set<string>();
  for (const observation of observations) {
    const id = observation.observationId.trim();
    if (id.length === 0) throw new Error("object model observationId is required");
    if (observationIds.has(id)) throw new Error(`duplicate object-model observationId ${id}`);
    observationIds.add(id);
  }

  const clusters: MutableCluster[] = [];
  for (const observation of observations) {
    const usedClusters = new Set<number>();
    const modes = [...observation.fingerprint.modes].sort((left, right) => left.frequencyHz - right.frequencyHz);
    for (const mode of modes) {
      let bestIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < clusters.length; index += 1) {
        if (usedClusters.has(index)) continue;
        const distance = centsDistance(clusterCenterFrequency(clusters[index]!), mode.frequencyHz);
        if (distance <= config.clusteringToleranceCents && distance < bestDistance) {
          bestIndex = index;
          bestDistance = distance;
        }
      }
      const sample: ModeSample = {
        observationId: observation.observationId,
        frequencyHz: mode.frequencyHz,
        decaySeconds: mode.decaySeconds,
        relativeAmplitude: mode.relativeAmplitude,
      };
      if (bestIndex < 0) {
        clusters.push({ samples: [sample] });
        usedClusters.add(clusters.length - 1);
      } else {
        clusters[bestIndex]!.samples.push(sample);
        usedClusters.add(bestIndex);
      }
    }
  }

  const minimumSupport = Math.max(
    config.minimumObservationSupportCount,
    Math.ceil(observations.length * config.minimumObservationSupportFraction),
  );
  const modes = clusters
    .filter((cluster) => new Set(cluster.samples.map((sample) => sample.observationId)).size >= minimumSupport)
    .map((cluster): AcousticObjectModeEstimateV1 => {
      const frequencies = cluster.samples.map((sample) => sample.frequencyHz);
      const center = median(frequencies);
      const frequencyOffsets = frequencies.map((frequency) => centsDistance(center, frequency));
      const decays = cluster.samples.map((sample) => sample.decaySeconds);
      const decayLogs = decays.map((value) => Math.log(Math.max(value, 1e-9)));
      const amplitudes = cluster.samples.map((sample) => sample.relativeAmplitude);
      const amplitudeDb = amplitudes.map(dbAmplitude);
      const sourceObservationIds = [...new Set(cluster.samples.map((sample) => sample.observationId))].sort();
      return {
        frequencyHzMedian: center,
        frequencyMadCents: medianAbsoluteDeviation(frequencyOffsets),
        decaySecondsMedian: median(decays),
        decayLogMad: medianAbsoluteDeviation(decayLogs),
        relativeAmplitudeMedian: median(amplitudes),
        relativeAmplitudeDbMad: medianAbsoluteDeviation(amplitudeDb),
        observationSupportCount: sourceObservationIds.length,
        observationSupportFraction: sourceObservationIds.length / observations.length,
        sourceObservationIds,
      };
    })
    .sort((left, right) => left.frequencyHzMedian - right.frequencyHzMedian);

  return {
    schemaVersion: 1,
    objectModelVersion: "acoustic-object-model-1",
    specimenId,
    observationCount: observations.length,
    fingerprintAlgorithmVersions: [...new Set(observations.map((observation) => observation.fingerprint.algorithmVersion))].sort(),
    sampleRates: [...new Set(observations.map((observation) => observation.fingerprint.sampleRate))].sort((left, right) => left - right),
    modes,
  };
}

export interface FingerprintToObjectModelComparisonV1 {
  readonly comparisonVersion: "fingerprint-object-model-comparison-1";
  readonly specimenId: string;
  readonly matchedModelModes: number;
  readonly modelModeCount: number;
  readonly coverage: number;
  readonly medianFrequencyDistanceCents: number | null;
  readonly p90FrequencyDistanceCents: number | null;
  readonly normalizedDistance: number;
  readonly evidenceScore: number;
}

function percentile(values: readonly number[], quantile: number): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * quantile) - 1));
  return ordered[index] ?? null;
}

export function compareFingerprintToObjectModel(
  fingerprint: AcousticFingerprintV1,
  model: AcousticObjectModelV1,
  maximumMatchDistanceCents = 180,
): FingerprintToObjectModelComparisonV1 {
  if (!(maximumMatchDistanceCents > 0) || !Number.isFinite(maximumMatchDistanceCents)) {
    throw new Error("maximumMatchDistanceCents must be finite and positive");
  }
  const usedFingerprintModes = new Set<number>();
  const distances: number[] = [];
  for (const modelMode of model.modes) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < fingerprint.modes.length; index += 1) {
      if (usedFingerprintModes.has(index)) continue;
      const distance = centsDistance(modelMode.frequencyHzMedian, fingerprint.modes[index]!.frequencyHz);
      if (distance < bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    }
    if (bestIndex >= 0 && bestDistance <= maximumMatchDistanceCents) {
      usedFingerprintModes.add(bestIndex);
      distances.push(bestDistance);
    }
  }
  const coverage = model.modes.length === 0 ? 0 : distances.length / model.modes.length;
  const medianDistance = distances.length === 0 ? null : median(distances);
  const normalizedFrequency = medianDistance === null ? 1 : Math.min(1, medianDistance / maximumMatchDistanceCents);
  const normalizedDistance = Math.min(1, 0.65 * normalizedFrequency + 0.35 * (1 - coverage));
  return {
    comparisonVersion: "fingerprint-object-model-comparison-1",
    specimenId: model.specimenId,
    matchedModelModes: distances.length,
    modelModeCount: model.modes.length,
    coverage,
    medianFrequencyDistanceCents: medianDistance,
    p90FrequencyDistanceCents: percentile(distances, 0.9),
    normalizedDistance,
    evidenceScore: 1 - normalizedDistance,
  };
}
