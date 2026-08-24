import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import type { CaptureSettingsEvidence, FixedSetupProtocol, MaterialClass } from "./types";

export interface MeasurementStationV1 {
  readonly stationId: string;
  readonly deviceDescription: string;
  readonly operatingSystem: string;
  readonly runtime: string;
  readonly microphoneDescription: string | null;
  readonly captureSettings: CaptureSettingsEvidence | null;
}

export interface MeasurementRecordV1 {
  readonly schemaVersion: 1;
  readonly measurementContractVersion: "measurement-record-1";
  readonly measurementId: string;
  readonly createdAt: string;
  readonly specimenId: string;
  readonly sessionId: string;
  readonly attemptId: number;
  readonly material: MaterialClass;
  readonly acquisitionContractVersion: string;
  readonly softwareRevision: string;
  readonly fingerprintAlgorithmVersion: string;
  readonly setup: FixedSetupProtocol;
  readonly station: MeasurementStationV1;
  readonly fingerprint: AcousticFingerprintV1;
  readonly rawMicrophoneSamplesIncluded: false;
}

export type DerivationKind = "renderer" | "instrument" | "similarity" | "embedding" | "visualization" | "atlas-record";

export interface DerivationRecordV1 {
  readonly schemaVersion: 1;
  readonly derivationContractVersion: "derivation-record-1";
  readonly derivationId: string;
  readonly measurementId: string;
  readonly kind: DerivationKind;
  readonly algorithmVersion: string;
  readonly configDigest: string;
  readonly artifactDigest: string;
  readonly createdAt: string;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function contentDigest(value: unknown): Promise<string> {
  return sha256(canonicalize(value));
}

export async function createMeasurementRecord(
  input: Omit<MeasurementRecordV1, "schemaVersion" | "measurementContractVersion" | "measurementId" | "rawMicrophoneSamplesIncluded">,
): Promise<MeasurementRecordV1> {
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("measurement createdAt is invalid");
  if (!/^[0-9a-f]{40}$/.test(input.softwareRevision)) throw new Error("measurement softwareRevision must be exact 40-hex Git revision");
  if (input.specimenId.trim().length === 0 || input.sessionId.trim().length === 0) throw new Error("measurement specimen/session identity is required");
  if (!Number.isInteger(input.attemptId) || input.attemptId <= 0) throw new Error("measurement attemptId must be positive");
  if (input.fingerprint.algorithmVersion !== input.fingerprintAlgorithmVersion) {
    throw new Error("measurement fingerprint algorithm version mismatch");
  }
  const payload = {
    ...input,
    schemaVersion: 1 as const,
    measurementContractVersion: "measurement-record-1" as const,
    rawMicrophoneSamplesIncluded: false as const,
  };
  const measurementId = await contentDigest(payload);
  return { ...payload, measurementId };
}

export async function createDerivationRecord(
  input: Omit<DerivationRecordV1, "schemaVersion" | "derivationContractVersion" | "derivationId">,
): Promise<DerivationRecordV1> {
  if (!/^sha256:[0-9a-f]{64}$/.test(input.measurementId)) throw new Error("derivation measurementId must be a measurement content digest");
  if (!/^sha256:[0-9a-f]{64}$/.test(input.configDigest)) throw new Error("derivation configDigest is invalid");
  if (!/^sha256:[0-9a-f]{64}$/.test(input.artifactDigest)) throw new Error("derivation artifactDigest is invalid");
  if (input.algorithmVersion.trim().length === 0) throw new Error("derivation algorithmVersion is required");
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("derivation createdAt is invalid");
  const payload = {
    ...input,
    schemaVersion: 1 as const,
    derivationContractVersion: "derivation-record-1" as const,
  };
  const derivationId = await contentDigest(payload);
  return { ...payload, derivationId };
}

export async function verifyMeasurementRecord(record: MeasurementRecordV1): Promise<boolean> {
  const { measurementId, ...payload } = record;
  return measurementId === await contentDigest(payload);
}

export async function verifyDerivationRecord(record: DerivationRecordV1): Promise<boolean> {
  const { derivationId, ...payload } = record;
  return derivationId === await contentDigest(payload);
}
