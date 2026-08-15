import type { DeviceClass, MaterialClass, ValidationEvidenceV3 } from "./types";

export type EvidenceParseResult =
  | { readonly ok: true; readonly evidence: ValidationEvidenceV3 }
  | { readonly ok: false; readonly error: string };

const MATERIALS: readonly MaterialClass[] = [
  "metal", "glass", "ceramic", "wood", "stone", "plastic", "composite", "other",
];
const DEVICE_CLASSES: readonly DeviceClass[] = ["desktop", "mobile", "tablet", "other"];

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

function optionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function validCaptureSettings(value: unknown): boolean {
  if (value === null) return true;
  const settings = record(value);
  return settings !== undefined
    && optionalFiniteNumber(settings.sampleRate)
    && optionalFiniteNumber(settings.channelCount)
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
    && optionalFiniteNumber(timing.outputLatencyMs)
    && optionalFiniteNumber(timing.lastSchedulingMs);
}

function validQuality(value: unknown): boolean {
  const quality = record(value);
  return quality !== undefined
    && finiteNumber(quality.score)
    && finiteNumber(quality.snrDb)
    && finiteNumber(quality.clippedFraction)
    && finiteNumber(quality.peakAmplitude)
    && finiteNumber(quality.secondaryTransientRatio);
}

function validFingerprint(value: unknown): boolean {
  const fingerprint = record(value);
  if (fingerprint === undefined) return false;
  if (fingerprint.version !== 1 || fingerprint.algorithmVersion !== "er-dsp-1") return false;
  if (!finiteNumber(fingerprint.sampleRate) || fingerprint.sampleRate <= 0) return false;
  if (!finiteNumber(fingerprint.durationSeconds) || fingerprint.durationSeconds <= 0) return false;
  if (!Array.isArray(fingerprint.modes)) return false;
  return fingerprint.modes.every((value) => {
    const mode = record(value);
    return mode !== undefined
      && finiteNumber(mode.frequencyHz)
      && mode.frequencyHz > 0
      && finiteNumber(mode.relativeAmplitude)
      && finiteNumber(mode.decaySeconds)
      && mode.decaySeconds > 0
      && finiteNumber(mode.q)
      && finiteNumber(mode.confidence);
  });
}

function validRecurrence(value: unknown): boolean {
  const recurrence = record(value);
  return recurrence !== undefined
    && positiveInteger(recurrence.recordId)
    && finiteNumber(recurrence.medianCents)
    && recurrence.medianCents >= 0
    && finiteNumber(recurrence.meanCents)
    && recurrence.meanCents >= 0
    && nonNegativeInteger(recurrence.matchedCount)
    && nonNegativeInteger(recurrence.unmatchedReferenceCount)
    && Array.isArray(recurrence.matches);
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
    && finiteNumber(review.usefulSemitoneSpan)
    && review.usefulSemitoneSpan >= 0
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

export function parseValidationEvidence(value: unknown): EvidenceParseResult {
  const evidence = record(value);
  if (evidence === undefined) return { ok: false, error: "evidence must be a JSON object" };
  if (evidence.schemaVersion !== 3) return { ok: false, error: "requires validation evidence schema version 3" };
  if (evidence.evidenceContractVersion !== "validation-evidence-3") {
    return { ok: false, error: "unsupported evidence contract" };
  }
  if (evidence.gateAContractVersion !== "gate-a-1") return { ok: false, error: "unsupported Gate A contract" };
  if (!nonEmptyString(evidence.sessionId)) return { ok: false, error: "sessionId is missing" };
  if (!nonEmptyString(evidence.createdAt)) return { ok: false, error: "createdAt is missing" };
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
  const recordIds = new Set<number>();
  for (const value of evidence.records) {
    const entry = record(value);
    if (entry === undefined || typeof entry.id !== "number") return { ok: false, error: "measurement records are invalid" };
    if (recordIds.has(entry.id)) return { ok: false, error: "measurement record IDs must be unique" };
    recordIds.add(entry.id);
  }
  if (evidence.recordCount !== evidence.records.length) {
    return { ok: false, error: "recordCount does not match measurement records" };
  }

  if (!Array.isArray(evidence.recurrence) || !evidence.recurrence.every(validRecurrence)) {
    return { ok: false, error: "recurrence data is invalid" };
  }
  if (!evidence.recurrence.every((value) => {
    const recurrence = record(value);
    return recurrence !== undefined && typeof recurrence.recordId === "number" && recordIds.has(recurrence.recordId);
  })) {
    return { ok: false, error: "recurrence target does not belong to this evidence bundle" };
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
