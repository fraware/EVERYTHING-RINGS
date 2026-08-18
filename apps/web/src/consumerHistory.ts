import {
  isAcousticFingerprintAlgorithmVersion,
  type AcousticFingerprintV1,
  type AcousticMode,
  type AcousticModeDiagnostics,
} from "@everything-rings/dsp";
import { fingerprintSignature } from "@everything-rings/visual";

export const CONSUMER_HISTORY_STORAGE_KEY = "everything-rings:consumer-history:v1";
export const CONSUMER_HISTORY_SCHEMA_VERSION = 1;
export const MAX_CONSUMER_HISTORY_RECORDS = 24;

export interface ConsumerCaptureRecord {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly capturedAt: string;
  readonly softwareRevision: string | null;
  readonly signature: string;
  readonly fingerprint: AcousticFingerprintV1;
}

interface ConsumerHistoryEnvelope {
  readonly schemaVersion: 1;
  readonly records: readonly ConsumerCaptureRecord[];
}

export interface ConsumerHistoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isDiagnostics(value: unknown): value is AcousticModeDiagnostics {
  if (!isRecord(value)) return false;
  return finite(value.prominenceDb)
    && finite(value.persistenceSeconds)
    && finite(value.frequencyStdCents)
    && finite(value.decayFitScore)
    && finite(value.observationCount);
}

function isMode(value: unknown): value is AcousticMode {
  if (!isRecord(value)) return false;
  return finite(value.frequencyHz) && value.frequencyHz > 0
    && finite(value.relativeAmplitude) && value.relativeAmplitude >= 0
    && finite(value.decaySeconds) && value.decaySeconds > 0
    && finite(value.q) && value.q > 0
    && finite(value.confidence) && value.confidence >= 0 && value.confidence <= 1
    && isDiagnostics(value.diagnostics);
}

function isFingerprint(value: unknown): value is AcousticFingerprintV1 {
  if (!isRecord(value)) return false;
  return value.version === 1
    && isAcousticFingerprintAlgorithmVersion(value.algorithmVersion)
    && finite(value.sampleRate) && value.sampleRate > 0
    && finite(value.durationSeconds) && value.durationSeconds > 0
    && Array.isArray(value.modes)
    && value.modes.every(isMode);
}

function validRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
}

function isCaptureRecord(value: unknown): value is ConsumerCaptureRecord {
  if (!isRecord(value)) return false;
  return value.schemaVersion === 1
    && typeof value.id === "string"
    && value.id.length > 0
    && typeof value.capturedAt === "string"
    && Number.isFinite(Date.parse(value.capturedAt))
    && (value.softwareRevision === null || validRevision(value.softwareRevision))
    && typeof value.signature === "string"
    && /^er1-[0-9a-f]{16}$/.test(value.signature)
    && isFingerprint(value.fingerprint)
    && fingerprintSignature(value.fingerprint) === value.signature;
}

export function createConsumerCaptureRecord(
  fingerprint: AcousticFingerprintV1,
  capturedAt: string,
  softwareRevision: string,
): ConsumerCaptureRecord {
  if (!Number.isFinite(Date.parse(capturedAt))) {
    throw new RangeError("capturedAt must be an ISO-compatible timestamp");
  }
  const signature = fingerprintSignature(fingerprint);
  return {
    schemaVersion: 1,
    id: `${capturedAt}-${signature}`,
    capturedAt,
    softwareRevision: validRevision(softwareRevision) ? softwareRevision : null,
    signature,
    fingerprint,
  };
}

export function loadConsumerHistory(
  storage: ConsumerHistoryStorage | undefined,
): readonly ConsumerCaptureRecord[] {
  if (storage === undefined) return [];
  try {
    const raw = storage.getItem(CONSUMER_HISTORY_STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.records)) return [];
    const seen = new Set<string>();
    const records: ConsumerCaptureRecord[] = [];
    for (const candidate of parsed.records) {
      if (!isCaptureRecord(candidate) || seen.has(candidate.id)) continue;
      seen.add(candidate.id);
      records.push(candidate);
      if (records.length >= MAX_CONSUMER_HISTORY_RECORDS) break;
    }
    return records;
  } catch {
    return [];
  }
}

export function prependConsumerCapture(
  records: readonly ConsumerCaptureRecord[],
  record: ConsumerCaptureRecord,
): readonly ConsumerCaptureRecord[] {
  return [
    record,
    ...records.filter((candidate) => candidate.id !== record.id),
  ].slice(0, MAX_CONSUMER_HISTORY_RECORDS);
}

export function removeConsumerCapture(
  records: readonly ConsumerCaptureRecord[],
  id: string,
): readonly ConsumerCaptureRecord[] {
  return records.filter((record) => record.id !== id);
}

export function persistConsumerHistory(
  storage: ConsumerHistoryStorage | undefined,
  records: readonly ConsumerCaptureRecord[],
): boolean {
  if (storage === undefined) return false;
  const envelope: ConsumerHistoryEnvelope = {
    schemaVersion: CONSUMER_HISTORY_SCHEMA_VERSION,
    records: records.slice(0, MAX_CONSUMER_HISTORY_RECORDS),
  };
  try {
    storage.setItem(CONSUMER_HISTORY_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function clearConsumerHistory(storage: ConsumerHistoryStorage | undefined): boolean {
  if (storage === undefined) return false;
  try {
    storage.removeItem(CONSUMER_HISTORY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
