import type { MaterialClass, ValidationEvidenceV3 } from "./types";

export type EvidenceParseResult =
  | { readonly ok: true; readonly evidence: ValidationEvidenceV3 }
  | { readonly ok: false; readonly error: string };

const MATERIALS: readonly MaterialClass[] = [
  "metal", "glass", "ceramic", "wood", "stone", "plastic", "composite", "other",
];

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validFingerprint(value: unknown): boolean {
  const fingerprint = record(value);
  if (fingerprint === undefined) return false;
  if (fingerprint.version !== 1 || fingerprint.algorithmVersion !== "er-dsp-1") return false;
  if (!finiteNumber(fingerprint.sampleRate) || !finiteNumber(fingerprint.durationSeconds)) return false;
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
    && finiteNumber(recurrence.recordId)
    && finiteNumber(recurrence.medianCents)
    && finiteNumber(recurrence.meanCents)
    && finiteNumber(recurrence.matchedCount)
    && finiteNumber(recurrence.unmatchedReferenceCount)
    && Array.isArray(recurrence.matches);
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

  const object = record(evidence.object);
  if (object === undefined || !nonEmptyString(object.label)) return { ok: false, error: "object label is missing" };
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

  if (!finiteNumber(evidence.recordCount) || evidence.recordCount < 0) return { ok: false, error: "recordCount is invalid" };
  if (!(evidence.medianModalDriftCents === null || finiteNumber(evidence.medianModalDriftCents))) {
    return { ok: false, error: "median modal drift is invalid" };
  }
  if (!Array.isArray(evidence.recurrence) || !evidence.recurrence.every(validRecurrence)) {
    return { ok: false, error: "recurrence data is invalid" };
  }
  if (!Array.isArray(evidence.records) || !evidence.records.every((value) => {
    const entry = record(value);
    return entry !== undefined && finiteNumber(entry.id) && record(entry.quality) !== undefined && validFingerprint(entry.fingerprint);
  })) {
    return { ok: false, error: "measurement records are invalid" };
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
