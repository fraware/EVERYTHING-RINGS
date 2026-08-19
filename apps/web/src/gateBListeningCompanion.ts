import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import {
  evaluateGateASession,
  type ValidationEvidenceV5,
} from "@everything-rings/validation";

export interface GateBListeningCompanionV1 {
  readonly schemaVersion: 1;
  readonly companionContractVersion: "gate-b-listening-companion-1";
  readonly createdAt: string;
  readonly softwareRevision: string;
  readonly specimenId: string;
  readonly sessionId: string;
  readonly attemptId: number;
  readonly sampleRate: number;
  readonly sampleCount: number;
  readonly sampleEncoding: "float32-le-base64";
  readonly audioSha256: string;
  readonly fingerprintSha256: string;
  readonly containsLocalMicrophoneSamples: true;
  readonly audioPayloadBase64: string;
}

export type GateBListeningCompanionParseResult =
  | {
      readonly ok: true;
      readonly companion: GateBListeningCompanionV1;
      readonly samples: Float32Array;
    }
  | { readonly ok: false; readonly error: string };

export type GateBListeningCompanionBindingResult =
  | { readonly ok: true; readonly fingerprint: AcousticFingerprintV1 }
  | { readonly ok: false; readonly error: string };

const MAX_SAMPLE_COUNT = 2_000_000;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const SOFTWARE_REVISION_PATTERN = /^[0-9a-f]{40}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonemptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${field} must be a positive integer`);
  }
  return value;
}

function positiveFinite(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${field} must be finite and positive`);
  }
  return value;
}

function encodeFloat32LittleEndian(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 4);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index] ?? 0;
    if (!Number.isFinite(sample)) throw new TypeError("listening companion samples must be finite");
    view.setFloat32(index * 4, sample, true);
  }
  return bytes;
}

function decodeFloat32LittleEndian(bytes: Uint8Array, sampleCount: number): Float32Array {
  if (bytes.byteLength !== sampleCount * 4) {
    throw new TypeError("audio payload byte length does not match sampleCount");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = view.getFloat32(index * 4, true);
    if (!Number.isFinite(sample)) throw new TypeError("audio payload contains non-finite samples");
    samples[index] = sample;
  }
  return samples;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new TypeError("audioPayloadBase64 is not valid base64");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const stable = new Uint8Array(bytes.byteLength);
  stable.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", stable.buffer);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function fingerprintSha256(fingerprint: AcousticFingerprintV1): Promise<string> {
  return sha256(new TextEncoder().encode(JSON.stringify(fingerprint)));
}

function parseCompanionShape(value: unknown): GateBListeningCompanionV1 {
  if (!isRecord(value)) throw new TypeError("listening companion must be an object");
  if (value.schemaVersion !== 1) throw new TypeError("schemaVersion must be 1");
  if (value.companionContractVersion !== "gate-b-listening-companion-1") {
    throw new TypeError("companionContractVersion must be gate-b-listening-companion-1");
  }
  const createdAt = nonemptyString(value.createdAt, "createdAt");
  if (!Number.isFinite(Date.parse(createdAt))) throw new TypeError("createdAt must be an ISO-compatible timestamp");
  const softwareRevision = nonemptyString(value.softwareRevision, "softwareRevision");
  if (!SOFTWARE_REVISION_PATTERN.test(softwareRevision)) {
    throw new TypeError("softwareRevision must be an exact 40-hex Git revision");
  }
  const sampleRate = positiveFinite(value.sampleRate, "sampleRate");
  const sampleCount = positiveInteger(value.sampleCount, "sampleCount");
  if (sampleCount > MAX_SAMPLE_COUNT) throw new TypeError(`sampleCount exceeds ${MAX_SAMPLE_COUNT}`);
  if (value.sampleEncoding !== "float32-le-base64") {
    throw new TypeError("sampleEncoding must be float32-le-base64");
  }
  const audioSha256 = nonemptyString(value.audioSha256, "audioSha256");
  const fingerprintDigest = nonemptyString(value.fingerprintSha256, "fingerprintSha256");
  if (!SHA256_PATTERN.test(audioSha256) || !SHA256_PATTERN.test(fingerprintDigest)) {
    throw new TypeError("companion digests must be sha256:<64 lowercase hex>");
  }
  if (value.containsLocalMicrophoneSamples !== true) {
    throw new TypeError("containsLocalMicrophoneSamples must be true");
  }
  return {
    schemaVersion: 1,
    companionContractVersion: "gate-b-listening-companion-1",
    createdAt,
    softwareRevision,
    specimenId: nonemptyString(value.specimenId, "specimenId"),
    sessionId: nonemptyString(value.sessionId, "sessionId"),
    attemptId: positiveInteger(value.attemptId, "attemptId"),
    sampleRate,
    sampleCount,
    sampleEncoding: "float32-le-base64",
    audioSha256,
    fingerprintSha256: fingerprintDigest,
    containsLocalMicrophoneSamples: true,
    audioPayloadBase64: nonemptyString(value.audioPayloadBase64, "audioPayloadBase64"),
  };
}

export async function createGateBListeningCompanion(
  evidence: ValidationEvidenceV5,
  samples: Float32Array,
  sampleRate: number,
  currentFingerprint: AcousticFingerprintV1,
  createdAt: string,
): Promise<GateBListeningCompanionV1> {
  const verdict = evaluateGateASession(evidence);
  if (!verdict.passed || verdict.reviewAttemptId === null) {
    throw new Error("listening companion requires a passing Gate A2 session");
  }
  const target = evidence.attempts.find((attempt) => attempt.id === verdict.reviewAttemptId);
  if (target?.analysis.status !== "success") {
    throw new Error("Gate A2 review target must contain a successful fingerprint");
  }
  if (JSON.stringify(target.analysis.fingerprint) !== JSON.stringify(currentFingerprint)) {
    throw new Error("current fingerprint does not match the selected Gate A2 review target");
  }
  if (sampleRate !== currentFingerprint.sampleRate) {
    throw new Error("current capture sample rate does not match the selected fingerprint");
  }
  if (samples.length === 0 || samples.length > MAX_SAMPLE_COUNT) {
    throw new RangeError(`listening companion sample count must be in [1, ${MAX_SAMPLE_COUNT}]`);
  }
  if (!Number.isFinite(Date.parse(createdAt))) throw new TypeError("createdAt must be an ISO-compatible timestamp");

  const audioBytes = encodeFloat32LittleEndian(samples);
  return {
    schemaVersion: 1,
    companionContractVersion: "gate-b-listening-companion-1",
    createdAt,
    softwareRevision: evidence.softwareRevision,
    specimenId: evidence.object.specimenId,
    sessionId: evidence.sessionId,
    attemptId: verdict.reviewAttemptId,
    sampleRate,
    sampleCount: samples.length,
    sampleEncoding: "float32-le-base64",
    audioSha256: await sha256(audioBytes),
    fingerprintSha256: await fingerprintSha256(currentFingerprint),
    containsLocalMicrophoneSamples: true,
    audioPayloadBase64: bytesToBase64(audioBytes),
  };
}

export async function parseGateBListeningCompanionJson(
  json: string,
): Promise<GateBListeningCompanionParseResult> {
  try {
    const companion = parseCompanionShape(JSON.parse(json) as unknown);
    const audioBytes = base64ToBytes(companion.audioPayloadBase64);
    if (audioBytes.byteLength !== companion.sampleCount * 4) {
      throw new TypeError("audio payload byte length does not match sampleCount");
    }
    if (await sha256(audioBytes) !== companion.audioSha256) {
      throw new TypeError("audio payload SHA-256 does not match companion metadata");
    }
    return {
      ok: true,
      companion,
      samples: decodeFloat32LittleEndian(audioBytes, companion.sampleCount),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function validateGateBListeningCompanionBinding(
  companion: GateBListeningCompanionV1,
  evidence: ValidationEvidenceV5,
): Promise<GateBListeningCompanionBindingResult> {
  try {
    const verdict = evaluateGateASession(evidence);
    if (!verdict.passed || verdict.reviewAttemptId === null) {
      throw new Error("evidence is not an eligible passing Gate A2 session");
    }
    if (evidence.rawMicrophoneSamplesIncluded !== false) {
      throw new Error("validation evidence raw-microphone invariant failed");
    }
    if (companion.softwareRevision !== evidence.softwareRevision) throw new Error("software revision mismatch");
    if (companion.specimenId !== evidence.object.specimenId) throw new Error("specimen ID mismatch");
    if (companion.sessionId !== evidence.sessionId) throw new Error("session ID mismatch");
    if (companion.attemptId !== verdict.reviewAttemptId) throw new Error("review attempt mismatch");

    const target = evidence.attempts.find((attempt) => attempt.id === verdict.reviewAttemptId);
    if (target?.analysis.status !== "success") throw new Error("selected evidence target has no fingerprint");
    if (companion.sampleRate !== target.analysis.fingerprint.sampleRate) throw new Error("sample rate mismatch");
    if (await fingerprintSha256(target.analysis.fingerprint) !== companion.fingerprintSha256) {
      throw new Error("selected fingerprint SHA-256 does not match companion metadata");
    }
    return { ok: true, fingerprint: target.analysis.fingerprint };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
