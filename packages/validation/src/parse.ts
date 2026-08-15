import { deriveEvidenceRecurrence, deriveMedianModalDriftCents } from "./derive";
import type {
  AnalysisFailureReasonEvidence,
  DeviceClass,
  EvidenceRecurrence,
  MaterialClass,
  ValidationEvidenceAttempt,
  ValidationEvidenceV5,
} from "./types";

export type EvidenceParseResult =
  | { readonly ok: true; readonly evidence: ValidationEvidenceV5 }
  | { readonly ok: false; readonly error: string };

const MATERIALS: readonly MaterialClass[] = [
  "metal", "glass", "ceramic", "wood", "stone", "plastic", "composite", "other",
];
const DEVICE_CLASSES: readonly DeviceClass[] = ["desktop", "mobile", "tablet", "other"];
const ANALYSIS_FAILURE_REASONS: readonly AnalysisFailureReasonEvidence[] = [
  "SIGNAL_TOO_SHORT", "NO_STABLE_RESONANCES", "ANALYSIS_INTERNAL_ERROR",
];
const NUMBER_TOLERANCE = 1e-9;
const SOFTWARE_REVISION_PATTERN = /^[0-9a-f]{40}$/;

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

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function score(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
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
  if (!Array.isArray(fingerprint.modes) || fingerprint.modes.length < 3 || fingerprint.modes.length > 16) return false;
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

function validAnalysis(value: unknown): boolean {
  const analysis = record(value);
  if (analysis === undefined) return false;
  if (analysis.status === "success") return validFingerprint(analysis.fingerprint);
  return analysis.status === "failure"
    && typeof analysis.reason === "string"
    && ANALYSIS_FAILURE_REASONS.includes(analysis.reason as AnalysisFailureReasonEvidence);
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
    || !positiveInteger(recurrence.attemptId)
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
    && positiveInteger(review.attemptId)
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
    && positiveInteger(review.attemptId)
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
  successfulAttemptIds: ReadonlySet<number>,
): boolean {
  const review = record(value);
  return review !== undefined
    && review.sessionId === sessionId
    && typeof review.objectLabel === "string"
    && normalized(review.objectLabel) === normalized(objectLabel)
    && typeof review.attemptId === "number"
    && successfulAttemptIds.has(review.attemptId);
}

function recurrenceMatchesDerived(cached: EvidenceRecurrence, derived: EvidenceRecurrence): boolean {
  if (cached.attemptId !== derived.attemptId
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
      && (cachedMatch.candidateFrequencyHz === undefined) === (derivedMatch.candidateFrequencyHz === undefined)
      && (cachedMatch.candidateFrequencyHz === undefined
        || derivedMatch.candidateFrequencyHz === undefined
        || closeNumber(cachedMatch.candidateFrequencyHz, derivedMatch.candidateFrequencyHz))
      && closeNumber(cachedMatch.distanceCents, derivedMatch.distanceCents);
  });
}

function validateReviewUniqueness(evidence: Record<string, unknown>): string | undefined {
  const gateBReviews = evidence.gateBReviews as unknown[];
  const gateCReviews = evidence.gateCReviews as unknown[];
  const reviewIds = new Set<string>();
  const gateBLogical = new Set<string>();
  const gateCLogical = new Set<string>();
  const deviceClassById = new Map<string, string>();

  for (const value of [...gateBReviews, ...gateCReviews]) {
    const review = record(value);
    if (review === undefined || typeof review.reviewId !== "string") return "review ID is invalid";
    const reviewId = review.reviewId.trim();
    if (reviewIds.has(reviewId)) return "review IDs must be unique within an evidence bundle";
    reviewIds.add(reviewId);
  }

  for (const value of gateBReviews) {
    const review = record(value);
    if (review === undefined || typeof review.reviewerId !== "string" || typeof review.sessionId !== "string" || typeof review.attemptId !== "number") {
      return "Gate B reviews are invalid";
    }
    const key = `${normalized(review.reviewerId)}\u0000${review.sessionId}\u0000${review.attemptId}`;
    if (gateBLogical.has(key)) return "Gate B contains duplicate logical reviewer judgments";
    gateBLogical.add(key);
  }

  for (const value of gateCReviews) {
    const review = record(value);
    if (review === undefined
      || typeof review.reviewerId !== "string"
      || typeof review.deviceId !== "string"
      || typeof review.deviceClass !== "string"
      || typeof review.sessionId !== "string"
      || typeof review.attemptId !== "number") return "Gate C reviews are invalid";
    const deviceId = normalized(review.deviceId);
    const previousClass = deviceClassById.get(deviceId);
    if (previousClass !== undefined && previousClass !== review.deviceClass) {
      return `device ID ${review.deviceId.trim()} has conflicting device classes`;
    }
    deviceClassById.set(deviceId, review.deviceClass);
    const key = `${normalized(review.reviewerId)}\u0000${deviceId}\u0000${review.sessionId}\u0000${review.attemptId}`;
    if (gateCLogical.has(key)) return "Gate C contains duplicate logical reviewer/device judgments";
    gateCLogical.add(key);
  }
  return undefined;
}

export function parseValidationEvidence(value: unknown): EvidenceParseResult {
  const evidence = record(value);
  if (evidence === undefined) return { ok: false, error: "evidence must be a JSON object" };
  if (evidence.schemaVersion !== 5) return { ok: false, error: "requires validation evidence schema version 5" };
  if (evidence.evidenceContractVersion !== "validation-evidence-5") {
    return { ok: false, error: "unsupported evidence contract" };
  }
  if (evidence.gateAContractVersion !== "gate-a-2") return { ok: false, error: "unsupported Gate A contract" };
  if (!nonEmptyString(evidence.sessionId)) return { ok: false, error: "sessionId is missing" };
  if (!nonEmptyString(evidence.createdAt) || !Number.isFinite(Date.parse(evidence.createdAt))) {
    return { ok: false, error: "createdAt is invalid" };
  }
  if (typeof evidence.softwareRevision !== "string" || !SOFTWARE_REVISION_PATTERN.test(evidence.softwareRevision)) {
    return { ok: false, error: "softwareRevision must be a lowercase 40-hex commit SHA" };
  }
  const sessionId = evidence.sessionId;

  const object = record(evidence.object);
  if (object === undefined || !nonEmptyString(object.specimenId)) return { ok: false, error: "specimen ID is missing" };
  if (!nonEmptyString(object.label)) return { ok: false, error: "object label is missing" };
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

  if (!nonNegativeInteger(evidence.attemptCount)) return { ok: false, error: "attemptCount is invalid" };
  if (!(evidence.medianModalDriftCents === null || (finiteNumber(evidence.medianModalDriftCents) && evidence.medianModalDriftCents >= 0))) {
    return { ok: false, error: "median modal drift is invalid" };
  }
  if (!Array.isArray(evidence.attempts) || !evidence.attempts.every((value) => {
    const attempt = record(value);
    return attempt !== undefined
      && positiveInteger(attempt.id)
      && validQuality(attempt.quality)
      && validAnalysis(attempt.analysis);
  })) {
    return { ok: false, error: "qualified attempts are invalid" };
  }
  const attempts = evidence.attempts as unknown as readonly ValidationEvidenceAttempt[];
  const successfulAttemptIds = new Set<number>();
  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    if (attempt === undefined || attempt.id !== index + 1) {
      return { ok: false, error: "qualified attempt IDs must be sequential from 1" };
    }
    if (attempt.analysis.status === "success") successfulAttemptIds.add(attempt.id);
  }
  if (evidence.attemptCount !== attempts.length) {
    return { ok: false, error: "attemptCount does not match qualified attempts" };
  }

  if (!Array.isArray(evidence.recurrence) || !evidence.recurrence.every(validRecurrence)) {
    return { ok: false, error: "recurrence data is invalid" };
  }
  const cachedRecurrence = evidence.recurrence as unknown as readonly EvidenceRecurrence[];
  const derivedRecurrence = deriveEvidenceRecurrence(attempts);
  if (cachedRecurrence.length !== derivedRecurrence.length
    || !cachedRecurrence.every((cached, index) => {
      const derived = derivedRecurrence[index];
      return derived !== undefined && recurrenceMatchesDerived(cached, derived);
    })) {
    return { ok: false, error: "recurrence cache does not match the qualified-attempt fingerprints" };
  }
  const derivedMedianDrift = deriveMedianModalDriftCents(attempts);
  if (derivedMedianDrift === null) {
    if (evidence.medianModalDriftCents !== null) return { ok: false, error: "median modal drift cache is inconsistent" };
  } else if (evidence.medianModalDriftCents === null || !closeNumber(evidence.medianModalDriftCents, derivedMedianDrift)) {
    return { ok: false, error: "median modal drift cache does not match the qualified-attempt fingerprints" };
  }

  if (!Array.isArray(evidence.gateBReviews) || !evidence.gateBReviews.every(validGateBReview)) {
    return { ok: false, error: "Gate B reviews are invalid" };
  }
  if (!evidence.gateBReviews.every((review) => reviewTargetsBundle(review, sessionId, objectLabel, successfulAttemptIds))) {
    return { ok: false, error: "Gate B review target does not belong to a successful attempt in this evidence bundle" };
  }
  if (!Array.isArray(evidence.gateCReviews) || !evidence.gateCReviews.every(validGateCReview)) {
    return { ok: false, error: "Gate C reviews are invalid" };
  }
  if (!evidence.gateCReviews.every((review) => reviewTargetsBundle(review, sessionId, objectLabel, successfulAttemptIds))) {
    return { ok: false, error: "Gate C review target does not belong to a successful attempt in this evidence bundle" };
  }
  const uniquenessError = validateReviewUniqueness(evidence);
  if (uniquenessError !== undefined) return { ok: false, error: uniquenessError };
  if (evidence.rawMicrophoneSamplesIncluded !== false) {
    return { ok: false, error: "raw microphone samples invariant failed" };
  }

  return { ok: true, evidence: evidence as unknown as ValidationEvidenceV5 };
}

export function parseValidationEvidenceJson(text: string): EvidenceParseResult {
  try {
    return parseValidationEvidence(JSON.parse(text) as unknown);
  } catch {
    return { ok: false, error: "invalid JSON" };
  }
}
