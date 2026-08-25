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
  readonly measurementId?: string;
  readonly support?: string;
  readonly stationId?: string;
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

export function isSpatialPredictedFingerprint(value: unknown): value is SpatialPredictedFingerprintV1 {
  if (typeof value !== "object" || value === null) return false;
  const record = value as { predictionContractVersion?: unknown; evidenceEligible?: unknown };
  return record.predictionContractVersion === "spatial-predicted-fingerprint-1" && record.evidenceEligible === false;
}

function assertSpatialObservationIsMeasurement(observation: SpatialFingerprintObservationV1): void {
  if (isSpatialPredictedFingerprint(observation.fingerprint)) {
    throw new Error(`spatial observation ${observation.observationId} is a predicted fingerprint, not a measurement`);
  }
  if (!("algorithmVersion" in observation.fingerprint)) {
    throw new Error(`spatial observation ${observation.observationId} is missing measurement algorithm provenance`);
  }
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
    assertSpatialObservationIsMeasurement(observation);
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

export interface SpatialHeldOutCaseV1 {
  readonly observationId: string;
  readonly interpolationDistance: number;
  readonly matchedModeCount: number;
  readonly predictedModeCount: number;
  readonly measuredModeCount: number;
  readonly frequencyErrorCentsMedian: number | null;
  readonly relativeAmplitudeErrorDbMedian: number | null;
  readonly meanPredictionUncertainty: number | null;
}

/**
 * Held-out strike-location evaluation. Predictions remain
 * SpatialPredictedFingerprintV1 and are never ingested as measurements.
 */
export interface SpatialHeldOutEvaluationV1 {
  readonly evaluationVersion: "spatial-held-out-evaluation-1";
  readonly evidenceEligible: false;
  readonly releaseGateEquivalent: false;
  readonly heldOutCount: number;
  readonly frequencyConsistencyMedianCents: number | null;
  readonly modePresencePrecision: number | null;
  readonly modePresenceRecall: number | null;
  readonly relativeAmplitudeErrorDbMedian: number | null;
  readonly uncertaintyErrorPearson: number | null;
  readonly interpolationDistanceMedian: number | null;
  readonly cases: readonly SpatialHeldOutCaseV1[];
}

function medianNumber(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle]!;
  return (ordered[middle - 1]! + ordered[middle]!) / 2;
}

function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let index = 0; index < xs.length; index += 1) {
    const dx = xs[index]! - meanX;
    const dy = ys[index]! - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  if (!(denomX > 0) || !(denomY > 0)) return null;
  return numerator / Math.sqrt(denomX * denomY);
}

function nearestTrainingDistance(
  point: SpatialPointV1,
  training: readonly SpatialFingerprintObservationV1[],
): number {
  return Math.min(...training.map((observation) => distance(point, observation.strikePoint)));
}

function matchPredictedToMeasured(
  predicted: SpatialPredictedFingerprintV1,
  measured: AcousticFingerprintV1,
  associationCents: number,
): {
  matched: number;
  frequencyErrors: number[];
  amplitudeErrorsDb: number[];
  uncertainties: number[];
} {
  const usedMeasured = new Set<number>();
  const frequencyErrors: number[] = [];
  const amplitudeErrorsDb: number[] = [];
  const uncertainties: number[] = [];
  let matched = 0;
  for (const predictedMode of predicted.modes) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < measured.modes.length; index += 1) {
      if (usedMeasured.has(index)) continue;
      const cents = centsDistance(predictedMode.frequencyHz, measured.modes[index]!.frequencyHz);
      if (cents < bestDistance) {
        bestIndex = index;
        bestDistance = cents;
      }
    }
    if (bestIndex >= 0 && bestDistance <= associationCents) {
      usedMeasured.add(bestIndex);
      matched += 1;
      frequencyErrors.push(bestDistance);
      amplitudeErrorsDb.push(
        20 * Math.abs(Math.log10(Math.max(predictedMode.relativeAmplitude, 1e-9) / Math.max(measured.modes[bestIndex]!.relativeAmplitude, 1e-9))),
      );
      uncertainties.push(1 - Math.min(1, Math.max(0, predictedMode.confidence)));
    }
  }
  return { matched, frequencyErrors, amplitudeErrorsDb, uncertainties };
}

export function evaluateSpatialHeldOutLocations(
  trainingObservations: readonly SpatialFingerprintObservationV1[],
  heldOutObservations: readonly SpatialFingerprintObservationV1[],
  options?: {
    readonly maximumModeAssociationCents?: number;
    readonly interpolationPower?: number;
  },
): SpatialHeldOutEvaluationV1 {
  if (heldOutObservations.length === 0) throw new Error("spatial held-out evaluation requires held-out observations");
  const trainingIds = new Set(trainingObservations.map((observation) => observation.observationId.trim()));
  for (const observation of heldOutObservations) {
    assertSpatialObservationIsMeasurement(observation);
    assertPoint(observation.strikePoint);
    if (trainingIds.has(observation.observationId.trim())) {
      throw new Error(`held-out spatial observation ${observation.observationId} is also in the training field`);
    }
  }
  const field = buildSpatialModalSoundField(
    trainingObservations,
    options?.maximumModeAssociationCents ?? 120,
  );
  const associationCents = options?.maximumModeAssociationCents ?? 120;
  const cases: SpatialHeldOutCaseV1[] = [];
  const allFrequencyErrors: number[] = [];
  const allAmplitudeErrors: number[] = [];
  const interpolationDistances: number[] = [];
  const uncertaintySeries: number[] = [];
  const errorSeries: number[] = [];
  let predictedPositive = 0;
  let measuredPositive = 0;
  let truePositive = 0;

  for (const observation of heldOutObservations) {
    const query: SpatialModalFieldQueryV1 = {
      point: observation.strikePoint,
      sampleRate: observation.fingerprint.sampleRate,
      durationSeconds: observation.fingerprint.durationSeconds,
      ...(options?.interpolationPower === undefined ? {} : { interpolationPower: options.interpolationPower }),
    };
    const predicted = fingerprintAtSpatialPoint(field, query);
    if (predicted.evidenceEligible !== false) {
      throw new Error("spatial held-out evaluation produced an evidence-eligible prediction");
    }
    if (isSpatialPredictedFingerprint(observation.fingerprint)) {
      throw new Error("spatial predicted fingerprints cannot be used as held-out measurements");
    }
    const matching = matchPredictedToMeasured(predicted, observation.fingerprint, associationCents);
    predictedPositive += predicted.modes.length;
    measuredPositive += observation.fingerprint.modes.length;
    truePositive += matching.matched;
    interpolationDistances.push(nearestTrainingDistance(observation.strikePoint, trainingObservations));
    allFrequencyErrors.push(...matching.frequencyErrors);
    allAmplitudeErrors.push(...matching.amplitudeErrorsDb);
    for (let index = 0; index < matching.frequencyErrors.length; index += 1) {
      uncertaintySeries.push(matching.uncertainties[index]!);
      errorSeries.push(matching.frequencyErrors[index]!);
    }
    cases.push({
      observationId: observation.observationId.trim(),
      interpolationDistance: interpolationDistances[interpolationDistances.length - 1]!,
      matchedModeCount: matching.matched,
      predictedModeCount: predicted.modes.length,
      measuredModeCount: observation.fingerprint.modes.length,
      frequencyErrorCentsMedian: medianNumber(matching.frequencyErrors),
      relativeAmplitudeErrorDbMedian: medianNumber(matching.amplitudeErrorsDb),
      meanPredictionUncertainty: matching.uncertainties.length === 0
        ? null
        : matching.uncertainties.reduce((sum, value) => sum + value, 0) / matching.uncertainties.length,
    });
  }

  cases.sort((left, right) => left.observationId.localeCompare(right.observationId, "en-US"));
  return {
    evaluationVersion: "spatial-held-out-evaluation-1",
    evidenceEligible: false,
    releaseGateEquivalent: false,
    heldOutCount: heldOutObservations.length,
    frequencyConsistencyMedianCents: medianNumber(allFrequencyErrors),
    modePresencePrecision: predictedPositive === 0 ? null : truePositive / predictedPositive,
    modePresenceRecall: measuredPositive === 0 ? null : truePositive / measuredPositive,
    relativeAmplitudeErrorDbMedian: medianNumber(allAmplitudeErrors),
    uncertaintyErrorPearson: pearson(uncertaintySeries, errorSeries),
    interpolationDistanceMedian: medianNumber(interpolationDistances),
    cases,
  };
}
