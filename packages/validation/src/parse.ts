import { deriveEvidenceRecurrence, deriveMedianModalDriftCents } from "./derive";
import type {
  DeviceClass,
  EvidenceRecurrence,
  MaterialClass,
  ValidationEvidenceRecord,
  ValidationEvidenceV3,
} from "./types";

export type EvidenceParseResult =
  | { readonly ok: true; readonly evidence: ValidationEvidenceV3 }
  | { readonly ok: false; readonly error: string };

const MATERIALS: readonly MaterialClass[] = [
  "metal", "glass", "ceramic", "wood", "stone", "plastic", "composite", "other",
];
const DEVICE_CLASSES: readonly DeviceClass[] = ["desktop", "mobile", "tablet", "other"];
const NUMBER_TOLERANCE = 1e-9;

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizedLabel(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function score(value: unknown): boolean {
  return Number.isInteger(value) && typeof value === "number" && value >= 1 && value <= 5;
}

function optionalFiniteNumber(value: unknown): boolean {
  return value === undefined || finiteNumber(value);
}

function optionalNonNegativeNumber(value: unknown): boolean {
  return value === undefined || (finiteNumber(value) && value >= 0);
}

function optionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function closeNumber(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= NUMBER_TOLERANCE * scale;
}

function validCaptureSettings(value: unknown): boolean {
  if (value === null) return true;
  const settings = record(value);
  return settings !== undefined
    && (settings.sampleRate === undefined || (finiteNumber(settings.sampleRate) && settings.sampleRate > 0))
    && (settings.channelCount === undefined || positiveInteger(settings.channelCount))
    && optionalBoolean(settings.echoCancellation)
    && optionalBoolean(settings.noiseSuppression)
    && optionalBoolean(settings.autoGainControl)
    && optionalString(settings.deviceId);
}

function validAudioTiming(value: unknown): boolean {
  if (value === null) return true;
  const timing = record(value);
  return timing !== undefined
    && finiteNumber(timing.baseLatencyMs)
    && timing.baseLatencyMs >= 0
    && finiteNumber(timing.renderQuantumMs)
    && timing.renderQuantumMs > 0
    && optionalNonNegativeNumber(timing.outputLatencyMs)
    && optionalNonNegativeNumber(timing.lastSchedulingMs);
}

function validQuality(value: unknown): boolean {
  const quality = record(value);
  return quality !== undefined
    && finiteNumber(quality.score)
    && quality.score >= 0
    && quality.score <= 1
    && finiteNumber(quality.snrDb)
    && finiteNumber(quality.clippedFraction)
    && quality.clippedFraction >= 0
    && quality.clippedFraction <= 1
    && finiteNumber(quality.peakAmplitude)
    && quality.peakAmplitude >= 0
    && finiteNumber(quality.secondaryTransientRatio)
    && quality.secondaryTransientRatio >= 0;
}

function validDiagnostics(value: unknown): boolean {
  const diagnostics = record(value);
  return diagnostics !== undefined
    && finiteNumber(diagnostics.prominenceDb)
    && finiteNumber(diagnostics.persistenceSeconds)
    && diagnostics.persistenceSeconds > 0
    && finiteNumber(diagnostics.frequencyStdCents)
    && diagnostics.frequencyStdCents >= 0
    && finiteNumber(diagnostics.decayFitScore)
    && diagnostics.decayFitScore >= 0
    && diagnostics.decayFitScore <= 1
    && positiveInteger(diagnostics.observationCount);
}

function validFingerprint(value: unknown): boolean {
  const fingerprint = record(value);
  if (fingerprint === undefined) return false;
  if (fingerprint.version !== 1 || fingerprint.algorithmVersion !== "er-dsp-1") return false;
  if (!finiteNumber(fingerprint.sampleRate) || fingerprint.sampleRate <= 0) return false;
  if (!finiteNumber(fingerprint.durationSeconds) || fingerprint.durationSeconds <= 0) return false;
  if (!Array.isArray(fingerprint.modes) || fingerprint.modes.length > 16) return false;
  const nyquistHz = fingerprint.sampleRate / 2;
  return fingerprint.modes.every((value) => {
    const mode = record(value);
    return mode !== undefined
      && finiteNumber(mode.frequencyHz)
      && mode.frequencyHz > 0
      && mode.frequencyHz < nyquistHz
      && finiteNumber(mode.relativeAmplitude)
      && mode.relativeAmplitude >= 0
      && mode.relativeAmplitude <= 1
      && finiteNumber(mode.decaySeconds)
      && mode.decaySeconds > 0
      && finiteNumber(mode.q)
      && mode.q > 0
      && finiteNumber(mode.confidence)
      && mode.confidence >= 0
      && mode.confidence <= 1
      && validDiagnostics(mode.diagnostics);
  });
}

function validModeMatch(value: unknown): boolean {
  const match = record(value);
  if (match === undefined) return false;
  const hasCandidateIndex = match.candidateIndex !== undefined;
  const hasCandidateFrequency = match.candidateFrequencyHz !== undefined;
  return nonNegativeInteger(match.referenceIndex)
    && finiteNumber(match.referenceFrequencyHz)
    && match.referenceFrequencyHz > 0
    && finiteNumber(match.distanceCents)
    && match.distanceCents >= 0
    && hasCandidateIndex === hasCandidateFrequency
    && (!hasCandidateIndex || nonNegativeInteger(match.candidateIndex))
    && (!hasCandidateFrequency || (finiteNumber(match.candidateFrequencyHz) && match.candidateFrequencyHz > 0));
}

function validRecurrence(value: unknown): boolean {
  const recurrence = record(value);
  if (recurrence === undefined
    || !positiveInteger(recurrence.recordId)
    || !finiteNumber(recurrence.medianCents)
    || recurrence.medianCents < 0
    || !finiteNumber(recurrence.meanCents)
    || recurrence.meanCents < 0
    || !nonNegativeInteger(recurrence.matchedCount)
    || !nonNegativeInteger(recurrence.unmatchedReferenceCount)
    || !Array.isArray(recurrence.matches)
    || !recurrence.matches.every(validModeMatch)) return false;

  const matchedCount = recurrence.matches.filter((value) => record(value)?.candidateIndex !== undefined).length;
  const unmatchedCount = recurrence.matches.length - matchedCount;
  return recurrence.matchedCount === matchedCount
    && recurrence.unmatchedReferenceCount === unmatchedCount;
}

function validGateBReview(value: unknown): boolean {
  const review = record(value);
  return review !== undefined
    && nonEmptyString(review.reviewId)
    && nonEmptyString(review.reviewerId)
    && nonEmptyString(review.objectLabel)
    && nonEmptyString(review.sessionId)
    && positiveInteger(review.recordId)
    && typeof review.blinded === "boolean"
    && (review.presentationOrder === "original-model" || review.presentationOrder === "model-original")
    && score(review.identity)
    && score(review.brightness)
    && score(review.decayCharacter)
    && score(review.artifactSeverity);
}

function validGateCReview(value: unknown): boolean {
  const review = record(value);
  return review !== undefined
    && nonEmptyString(review.reviewId)
    && nonEmptyString(review.reviewerId)
    && nonEmptyString(review.objectLabel)
    && nonEmptyString(review.sessionId)
    && positiveInteger(review.recordId)
    && nonEmptyString(review.deviceId)
    && typeof review.deviceClass === "string"
    && DEVICE_CLASSES.includes(review.deviceClass as DeviceClass)
    && score(review.identityAcrossRange)
    && score(review.timbreContinuity)
    && nonNegativeInteger(review.usefulSemitoneSpan)
    && typeof review.latencyAcceptable === "boolean";
}

function reviewTargetsBundle(
  value: unknown,
  sessionId: string,
  objectLabel: string,
  recordIds: ReadonlySet<number>,
): boolean {
  const review = record(value);
  return review !== undefined
    && review.sessionId === sessionId
    && typeof review.objectLabel === "string"
    && normalizedLabel(review.objectLabel) === normalizedLabel(objectLabel)
    && typeof review.recordId === "number"
    && recordIds.has(review.recordId);
}

function recurrenceMatchesDerived(cached: EvidenceRecurrence, derived: EvidenceRecurrence): boolean {
  if (cached.recordId !== derived.recordId
    || cached.matchedCount !== derived.matchedCount
    || cached.unmatchedReferenceCount !== derived.unmatchedReferenceCount
    || !closeNumber(cached.medianCents, derived.medianCents)
    || !closeNumber(cached.meanCents, derived.meanCents)
    || cached.matches.length !== derived.matches.length) return false;

  return cached.matches.every((cachedMatch, index) => {
    const derivedMatch = derived.matches[index];
    if (derivedMatch === undefined) return false;
    return cachedMatch.referenceIndex === derivedMatch.referenceIndex
      && cachedMatch.candidateIndex === derivedMatch.candidateIndex
      && closeNumber(cachedMatch.referenceFrequencyHz, derivedMatch.referenceFrequencyHz)
      && cachedMatch.candidateFrequencyHz === undefined === (derivedMatch.candidateFrequencyHz === undefined)
      && (cachedMatch.candidateFrequencyHz === undefined
        || derivedMatch.candidateFrequencyHz === undefined
        || closeNumber(cachedMatch.candidateFrequencyHz, derivedMatch.candidateFrequencyHz))
      && closeNumber(cachedMatch.distanceCents, derivedMatch.distanceCents);
  });
}

export function parseValidationEvidence(value: unknown): EvidenceParseResult {
  const evidence = record(value);
  if (evidence === undefined) return { ok: false, error: "evidence must be a JSON object" };
  if (evidence.schemaVersion !== 3) return { ok: false, error: "requires validation evidence schema version 3" };
  if (evidence.evidenceContractVersion !== "validation-evidence-3") {
    return { ok: false, error: "unsupported evidence contract" };
  }
  if (evidence.gateAContractVersion !== "gate-a-1") return { ok: false, error: "unsupported Gate A contract" };
  if (!nonEmptyString(evidence.sessionId)) return { ok: false, error: "sessionId is missing" };
  if (!nonEmptyString(evidence.createdAt) || !Number.isFinite(Date.parse(evidence.createdAt))) {
    return { ok: false, error: "createdAt is invalid" };
  }
  const sessionId = evidence.sessionId;

  const object = record(evidence.object);
  if (object === undefined || !nonEmptyString(object.label)) return { ok: false, error: "object label is missing" };
  const objectLabel = object.label;
  if (typeof object.material !== "string" || !MATERIALS.includes(object.material as MaterialClass)) {
    return { ok: false, error: "object material is invalid" };
  }

  const protocol = record(evidence.protocol);
  if (protocol === undefined || protocol.fixedSetup !== true) return { ok: false, error: "fixed setup protocol is missing" };
  if (!finiteNumber(protocol.microphoneDistanceCm) || protocol.microphoneDistanceCm <= 0) {
    return { ok: false, error: "microphone distance must be positive" };
  }
  if (!nonEmptyString(protocol.striker)) return { ok: false, error: "striker is missing" };
  if (!nonEmptyString(protocol.strikeLocation)) return { ok: false, error: "strike location is missing" };
  if (!nonEmptyString(protocol.supportCondition)) return { ok: false, error: "support condition is missing" };
  if (!validCaptureSettings(evidence.captureSettings)) return { ok: false, error: "capture settings are invalid" };
  if (!validAudioTiming(evidence.realtimeAudioTiming)) return { ok: false, error: "realtime audio timing is invalid" };

  if (!nonNegativeInteger(evidence.recordCount)) return { ok: false, error: "recordCount is invalid" };
  if (!(evidence.medianModalDriftCents === null || (finiteNumber(evidence.medianModalDriftCents) && evidence.medianModalDriftCents >= 0))) {
    return { ok: false, error: "median modal drift is invalid" };
  }
  if (!Array.isArray(evidence.records) || !evidence.records.every((value) => {
    const entry = record(value);
    return entry !== undefined && positiveInteger(entry.id) && validQuality(entry.quality) && validFingerprint(entry.fingerprint);
  })) {
    return { ok: false, error: "measurement records are invalid" };
  }
  const records = evidence.records as unknown as readonly ValidationEvidenceRecord[];
  const recordIds = new Set<number>();
  for (let index = 0; index < records.length; index += 1) {
    const entry = records[index];
    if (entry === undefined) return { ok: false, error: "measurement records are invalid" };
    if (recordIds.has(entry.id)) return { ok: false, error: "measurement record IDs must be unique" };
    if (entry.id !== index + 1) return { ok: false, error: "measurement record IDs must be sequential from 1" };
    recordIds.add(entry.id);
  }
  if (evidence.recordCount !== records.length) {
    return { ok: false, error: "recordCount does not match measurement records" };
  }

  if (!Array.isArray(evidence.recurrence) || !evidence.recurrence.every(validRecurrence)) {
    return { ok: false, error: "recurrence data is invalid" };
  }
  const cachedRecurrence = evidence.recurrence as unknown as readonly EvidenceRecurrence[];
  const derivedRecurrence = deriveEvidenceRecurrence(records);
  if (cachedRecurrence.length !== derivedRecurrence.length
    || !cachedRecurrence.every((cached, index) => {
      const derived = derivedRecurrence[index];
      return derived !== undefined && recurrenceMatchesDerived(cached, derived);
    })) {
    return { ok: false, error: "recurrence cache does not match the measurement fingerprints" };
  }
  const derivedMedianDrift = deriveMedianModalDriftCents(records);
  if (derivedMedianDrift === null) {
    if (evidence.medianModalDriftCents !== null) return { ok: false, error: "median modal drift cache is inconsistent" };
  } else if (evidence.medianModalDriftCents === null || !closeNumber(evidence.medianModalDriftCents, derivedMedianDrift)) {
    return { ok: false, error: "median modal drift cache does not match the measurement fingerprints" };
  }

  if (!Array.isArray(evidence.gateBReviews) || !evidence.gateBReviews.every(validGateBReview)) {
    return { ok: false, error: "Gate B reviews are invalid" };
  }
  if (!evidence.gateBReviews.every((review) => reviewTargetsBundle(review, sessionId, objectLabel, recordIds))) {
    return { ok: false, error: "Gate B review target does not belong to this evidence bundle" };
  }
  if (!Array.isArray(evidence.gateCReviews) || !evidence.gateCReviews.every(validGateCReview)) {
    return { ok: false, error: "Gate C reviews are invalid" };
  }
  if (!evidence.gateCReviews.every((review) => reviewTargetsBundle(review, sessionId, objectLabel, recordIds))) {
    return { ok: false, error: "Gate C review target does not belong to this evidence bundle" };
  }
  const reviewIds = new Set<string>();
  for (const value of [...evidence.gateBReviews, ...evidence.gateCReviews]) {
    const review = record(value);
    if (review === undefined || typeof review.reviewId !== "string") return { ok: false, error: "review ID is invalid" };
    const key = review.reviewId.trim();
    if (reviewIds.has(key)) return { ok: false, error: "review IDs must be unique within an evidence bundle" };
    reviewIds.add(key);
  }
  if (evidence.rawMicrophoneSamplesIncluded !== false) {
    return { ok: false, error: "raw microphone samples invariant failed" };
  }

  return { ok: true, evidence: evidence as unknown as ValidationEvidenceV3 };
}

export function parseValidationEvidenceJson(text: string): EvidenceParseResult {
  try {
    return parseValidationEvidence(JSON.parse(text) as unknown);
  } catch {
    return { ok: false, error: "invalid JSON" };
  }
}
