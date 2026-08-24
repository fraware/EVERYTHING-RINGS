import type { AcousticFingerprintV1, AcousticMode, AcousticFingerprintAlgorithmVersion } from "@everything-rings/dsp";
import { centsDistance } from "./recurrence";
import { buildAcousticObjectModel, type AcousticObjectModelV1 } from "./object-model";

export interface SpatialPointV1 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SpatialFingerprintObservationV1 {
  readonly observationId: string;
  readonly specimenId: string;
  readonly strikePoint: SpatialPointV1;
  readonly fingerprint: AcousticFingerprintV1;
}

export interface SpatialModalSampleV1 {
  readonly observationId: string;
  readonly strikePoint: SpatialPointV1;
  readonly relativeAmplitude: number;
  readonly sourceFrequencyHz: number;
}

export interface SpatialModalFieldModeV1 {
  readonly frequencyHz: number;
  readonly decaySeconds: number;
  readonly samples: readonly SpatialModalSampleV1[];
}

export interface SpatialModalSoundFieldV1 {
  readonly schemaVersion: 1;
  readonly modalFieldVersion: "spatial-modal-sound-field-1";
  readonly specimenId: string;
  readonly objectModel: AcousticObjectModelV1;
  readonly modes: readonly SpatialModalFieldModeV1[];
  readonly observationCount: number;
}

function assertPoint(point: SpatialPointV1): void {
  if (![point.x, point.y, point.z].every(Number.isFinite)) throw new Error("spatial strike point coordinates must be finite");
}

export function buildSpatialModalSoundField(
  observations: readonly SpatialFingerprintObservationV1[],
  maximumModeAssociationCents = 120,
): SpatialModalSoundFieldV1 {
  if (observations.length < 2) throw new Error("spatial modal field requires at least two observations");
  if (!(maximumModeAssociationCents > 0) || !Number.isFinite(maximumModeAssociationCents)) throw new Error("maximumModeAssociationCents must be finite and positive");
  const specimenId = observations[0]!.specimenId.trim();
  if (specimenId.length === 0) throw new Error("spatial modal field specimenId is required");
  const normalized = specimenId.toLocaleLowerCase("en-US");
  const observationIds = new Set<string>();
  for (const observation of observations) {
    if (observation.specimenId.trim().toLocaleLowerCase("en-US") !== normalized) throw new Error("spatial modal field cannot mix specimen IDs");
    if (observationIds.has(observation.observationId)) throw new Error(`duplicate spatial observationId ${observation.observationId}`);
    observationIds.add(observation.observationId);
    assertPoint(observation.strikePoint);
  }
  const objectModel = buildAcousticObjectModel(observations.map((observation) => ({
    observationId: observation.observationId,
    specimenId: observation.specimenId,
    fingerprint: observation.fingerprint,
  })));

  const modes = objectModel.modes.map((modelMode): SpatialModalFieldModeV1 => {
    const samples: SpatialModalSampleV1[] = [];
    for (const observation of observations) {
      let best: { frequencyHz: number; relativeAmplitude: number; distance: number } | undefined;
      for (const mode of observation.fingerprint.modes) {
        const distance = centsDistance(modelMode.frequencyHzMedian, mode.frequencyHz);
        if (distance <= maximumModeAssociationCents && (best === undefined || distance < best.distance)) {
          best = { frequencyHz: mode.frequencyHz, relativeAmplitude: mode.relativeAmplitude, distance };
        }
      }
      if (best !== undefined) {
        samples.push({
          observationId: observation.observationId,
          strikePoint: observation.strikePoint,
          relativeAmplitude: best.relativeAmplitude,
          sourceFrequencyHz: best.frequencyHz,
        });
      }
    }
    return { frequencyHz: modelMode.frequencyHzMedian, decaySeconds: modelMode.decaySecondsMedian, samples };
  });

  return {
    schemaVersion: 1,
    modalFieldVersion: "spatial-modal-sound-field-1",
    specimenId,
    objectModel,
    modes,
    observationCount: observations.length,
  };
}

function distance(left: SpatialPointV1, right: SpatialPointV1): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}

function interpolateAmplitude(samples: readonly SpatialModalSampleV1[], point: SpatialPointV1, power: number): number {
  if (samples.length === 0) return 0;
  for (const sample of samples) if (distance(sample.strikePoint, point) <= 1e-9) return sample.relativeAmplitude;
  let weighted = 0;
  let weightSum = 0;
  for (const sample of samples) {
    const d = Math.max(1e-9, distance(sample.strikePoint, point));
    const weight = 1 / d ** power;
    weighted += weight * sample.relativeAmplitude;
    weightSum += weight;
  }
  return weightSum === 0 ? 0 : weighted / weightSum;
}

export interface SpatialModalFieldQueryV1 {
  readonly point: SpatialPointV1;
  readonly interpolationPower?: number;
  readonly sampleRate?: number;
  readonly durationSeconds?: number;
}

/**
 * A spatial-field prediction is a derived model output, not a fresh acoustic
 * measurement. It deliberately cannot be mistaken for an evidence-eligible
 * AcousticFingerprintV1 because it carries no canonical algorithmVersion.
 */
export interface SpatialPredictedFingerprintV1 {
  readonly schemaVersion: 1;
  readonly predictionContractVersion: "spatial-predicted-fingerprint-1";
  readonly evidenceEligible: false;
  readonly sourceFingerprintAlgorithmVersions: readonly AcousticFingerprintAlgorithmVersion[];
  readonly specimenId: string;
  readonly sampleRate: number;
  readonly durationSeconds: number;
  readonly strikePoint: SpatialPointV1;
  readonly modes: readonly AcousticMode[];
}

export function fingerprintAtSpatialPoint(
  field: SpatialModalSoundFieldV1,
  query: SpatialModalFieldQueryV1,
): SpatialPredictedFingerprintV1 {
  assertPoint(query.point);
  const interpolationPower = query.interpolationPower ?? 2;
  if (!(interpolationPower > 0) || !Number.isFinite(interpolationPower)) throw new Error("interpolationPower must be finite and positive");
  const amplitudes = field.modes.map((mode) => interpolateAmplitude(mode.samples, query.point, interpolationPower));
  const maximumAmplitude = Math.max(0, ...amplitudes);
  const sampleRate = query.sampleRate ?? field.objectModel.sampleRates[0] ?? 48_000;
  const durationSeconds = query.durationSeconds ?? 2;
  if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) throw new Error("spatial predicted sampleRate must be finite and positive");
  if (!(durationSeconds > 0) || !Number.isFinite(durationSeconds)) throw new Error("spatial predicted durationSeconds must be finite and positive");
  return {
    schemaVersion: 1,
    predictionContractVersion: "spatial-predicted-fingerprint-1",
    evidenceEligible: false,
    sourceFingerprintAlgorithmVersions: [...field.objectModel.fingerprintAlgorithmVersions],
    specimenId: field.specimenId,
    sampleRate,
    durationSeconds,
    strikePoint: { ...query.point },
    modes: field.modes.flatMap((mode, index): AcousticMode[] => {
      const amplitude = amplitudes[index] ?? 0;
      if (!(amplitude > 0) || !(maximumAmplitude > 0)) return [];
      const relativeAmplitude = amplitude / maximumAmplitude;
      return [{
        frequencyHz: mode.frequencyHz,
        relativeAmplitude,
        decaySeconds: mode.decaySeconds,
        q: Math.PI * mode.frequencyHz * mode.decaySeconds,
        confidence: Math.min(1, mode.samples.length / Math.max(1, field.observationCount)),
        diagnostics: {
          prominenceDb: 0,
          persistenceSeconds: mode.decaySeconds,
          frequencyStdCents: field.objectModel.modes[index]?.frequencyMadCents ?? 0,
          decayFitScore: 0,
          observationCount: mode.samples.length,
        },
      }];
    }),
  };
}
