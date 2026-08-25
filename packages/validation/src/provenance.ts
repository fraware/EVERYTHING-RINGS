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

/** V2 multi-source kinds. V1 `DerivationKind` remains the closed single-measurement set. */
export type DerivationKindV2 =
  | DerivationKind
  | "object-model"
  | "calibration"
  | "index"
  | "snapshot";

export const DERIVATION_RECORD_V2_CONTRACT_VERSION = "derivation-record-2" as const;

const DERIVATION_KINDS_V1: ReadonlySet<DerivationKind> = new Set([
  "renderer",
  "instrument",
  "similarity",
  "embedding",
  "visualization",
  "atlas-record",
]);

const DERIVATION_KINDS_V2: ReadonlySet<DerivationKindV2> = new Set([
  ...DERIVATION_KINDS_V1,
  "object-model",
  "calibration",
  "index",
  "snapshot",
]);

export function isDerivationKind(value: string): value is DerivationKind {
  return DERIVATION_KINDS_V1.has(value as DerivationKind);
}

export function isDerivationKindV2(value: string): value is DerivationKindV2 {
  return DERIVATION_KINDS_V2.has(value as DerivationKindV2);
}

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
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? String(value) : encoded;
  }
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

const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/;

export function isContentDigest(value: string): boolean {
  return SHA256_DIGEST.test(value);
}

export function canonicalizeContentDigests(ids: readonly string[], field: string): string[] {
  for (const id of ids) {
    if (!SHA256_DIGEST.test(id)) throw new Error(`${field} must be a sha256 content digest`);
  }
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) throw new Error(`${field} must not contain duplicates`);
  return unique.sort((left, right) => left.localeCompare(right, "en-US"));
}

export interface DerivationRecordV2 {
  readonly schemaVersion: 2;
  readonly derivationContractVersion: "derivation-record-2";
  readonly derivationId: string;
  readonly kind: DerivationKindV2;
  readonly algorithmVersion: string;
  readonly configDigest: string;
  readonly sourceMeasurementIds: readonly string[];
  readonly sourceDerivationIds: readonly string[];
  readonly sourceDatasetSnapshotIds: readonly string[];
  readonly artifactDigest: string;
  readonly createdAt: string;
}

function assertDerivationV2Sources(
  kind: DerivationKindV2,
  sourceMeasurementIds: readonly string[],
  sourceDerivationIds: readonly string[],
  sourceDatasetSnapshotIds: readonly string[],
): void {
  const total = sourceMeasurementIds.length + sourceDerivationIds.length + sourceDatasetSnapshotIds.length;
  if (total === 0) throw new Error("derivation V2 requires at least one source artifact");
  if (kind === "object-model" && sourceMeasurementIds.length === 0) {
    throw new Error("object-model derivation requires sourceMeasurementIds");
  }
  if (kind === "calibration" && sourceMeasurementIds.length === 0 && sourceDerivationIds.length === 0) {
    throw new Error("calibration derivation requires sourceMeasurementIds or sourceDerivationIds");
  }
  if (kind === "index" && sourceDatasetSnapshotIds.length === 0 && sourceDerivationIds.length === 0) {
    throw new Error("index derivation requires sourceDatasetSnapshotIds or sourceDerivationIds");
  }
  if (kind === "snapshot" && sourceDatasetSnapshotIds.length === 0 && sourceDerivationIds.length === 0) {
    throw new Error("snapshot derivation requires sourceDatasetSnapshotIds or sourceDerivationIds");
  }
}

export async function createDerivationRecordV2(
  input: Omit<DerivationRecordV2, "schemaVersion" | "derivationContractVersion" | "derivationId">,
): Promise<DerivationRecordV2> {
  if (!isDerivationKindV2(input.kind)) throw new Error("derivation V2 kind is invalid");
  if (input.algorithmVersion.trim().length === 0) throw new Error("derivation algorithmVersion is required");
  if (!SHA256_DIGEST.test(input.configDigest)) throw new Error("derivation configDigest is invalid");
  if (!SHA256_DIGEST.test(input.artifactDigest)) throw new Error("derivation artifactDigest is invalid");
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("derivation createdAt is invalid");
  const sourceMeasurementIds = canonicalizeContentDigests(input.sourceMeasurementIds, "sourceMeasurementIds");
  const sourceDerivationIds = canonicalizeContentDigests(input.sourceDerivationIds, "sourceDerivationIds");
  const sourceDatasetSnapshotIds = canonicalizeContentDigests(input.sourceDatasetSnapshotIds, "sourceDatasetSnapshotIds");
  assertDerivationV2Sources(input.kind, sourceMeasurementIds, sourceDerivationIds, sourceDatasetSnapshotIds);
  const payload = {
    algorithmVersion: input.algorithmVersion.trim(),
    artifactDigest: input.artifactDigest,
    configDigest: input.configDigest,
    createdAt: input.createdAt,
    derivationContractVersion: DERIVATION_RECORD_V2_CONTRACT_VERSION,
    kind: input.kind,
    schemaVersion: 2 as const,
    sourceDatasetSnapshotIds,
    sourceDerivationIds,
    sourceMeasurementIds,
  };
  return { ...payload, derivationId: await contentDigest(payload) };
}

export async function verifyDerivationRecordV2(record: DerivationRecordV2): Promise<boolean> {
  if (record.schemaVersion !== 2 || record.derivationContractVersion !== DERIVATION_RECORD_V2_CONTRACT_VERSION) return false;
  if (!isDerivationKindV2(record.kind) || record.algorithmVersion.trim().length === 0) return false;
  if (!SHA256_DIGEST.test(record.derivationId) || !SHA256_DIGEST.test(record.configDigest) || !SHA256_DIGEST.test(record.artifactDigest)) return false;
  if (!Number.isFinite(Date.parse(record.createdAt))) return false;
  try {
    const sourceMeasurementIds = canonicalizeContentDigests(record.sourceMeasurementIds, "sourceMeasurementIds");
    const sourceDerivationIds = canonicalizeContentDigests(record.sourceDerivationIds, "sourceDerivationIds");
    const sourceDatasetSnapshotIds = canonicalizeContentDigests(record.sourceDatasetSnapshotIds, "sourceDatasetSnapshotIds");
    if (
      sourceMeasurementIds.join("\0") !== record.sourceMeasurementIds.join("\0")
      || sourceDerivationIds.join("\0") !== record.sourceDerivationIds.join("\0")
      || sourceDatasetSnapshotIds.join("\0") !== record.sourceDatasetSnapshotIds.join("\0")
    ) return false;
    assertDerivationV2Sources(record.kind, sourceMeasurementIds, sourceDerivationIds, sourceDatasetSnapshotIds);
  } catch {
    return false;
  }
  const { derivationId, ...payload } = record;
  return derivationId === await contentDigest(payload);
}

/** Official V2 content-addressing vector. Arrays are stored sorted; permutation of inputs must not change derivationId. */
export const DERIVATION_RECORD_V2_TEST_VECTOR = {
  contractVersion: DERIVATION_RECORD_V2_CONTRACT_VERSION,
  input: {
    kind: "object-model" as const,
    algorithmVersion: "acoustic-object-model-1",
    configDigest: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    sourceMeasurementIds: [
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ],
    sourceDerivationIds: [] as const,
    sourceDatasetSnapshotIds: [] as const,
    artifactDigest: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    createdAt: "2026-08-25T00:00:00.000Z",
  },
  canonicalSourceMeasurementIds: [
    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  ],
  expectedDerivationId: "sha256:744c87f7f16b5d8db558ace3ebd570b52d72f07abba3dd3df0351b85e5afcdb0",
} as const;
