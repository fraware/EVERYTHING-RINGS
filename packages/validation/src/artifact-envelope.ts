import { contentDigest } from "./provenance";

export type EverythingRingsArtifactKind =
  | "measurement"
  | "derivation"
  | "atlas-record"
  | "atlas-snapshot"
  | "atlas-collection"
  | "station-calibration-protocol"
  | "station-calibration-verdict"
  | "sonic-twin-benchmark"
  | "software-qualification";

export interface ArtifactEnvelopeV1<T = unknown> {
  readonly schemaVersion: 1;
  readonly envelopeContractVersion: "everything-rings-artifact-envelope-1";
  readonly artifactKind: EverythingRingsArtifactKind;
  readonly artifactContractVersion: string;
  readonly createdAt: string;
  readonly payloadDigest: string;
  readonly envelopeId: string;
  readonly payload: T;
}

export async function createArtifactEnvelope<T>(
  artifactKind: EverythingRingsArtifactKind,
  artifactContractVersion: string,
  payload: T,
  createdAt: string,
): Promise<ArtifactEnvelopeV1<T>> {
  if (artifactContractVersion.trim().length === 0) throw new Error("artifactContractVersion is required");
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error("artifact envelope createdAt is invalid");
  const payloadDigest = await contentDigest(payload);
  const identity = {
    schemaVersion: 1 as const,
    envelopeContractVersion: "everything-rings-artifact-envelope-1" as const,
    artifactKind,
    artifactContractVersion: artifactContractVersion.trim(),
    createdAt,
    payloadDigest,
  };
  const envelopeId = await contentDigest(identity);
  return { ...identity, envelopeId, payload };
}

export async function verifyArtifactEnvelope(envelope: ArtifactEnvelopeV1): Promise<boolean> {
  if (envelope.schemaVersion !== 1 || envelope.envelopeContractVersion !== "everything-rings-artifact-envelope-1") return false;
  if (!/^sha256:[0-9a-f]{64}$/.test(envelope.payloadDigest) || !/^sha256:[0-9a-f]{64}$/.test(envelope.envelopeId)) return false;
  if (await contentDigest(envelope.payload) !== envelope.payloadDigest) return false;
  const identity = {
    schemaVersion: envelope.schemaVersion,
    envelopeContractVersion: envelope.envelopeContractVersion,
    artifactKind: envelope.artifactKind,
    artifactContractVersion: envelope.artifactContractVersion,
    createdAt: envelope.createdAt,
    payloadDigest: envelope.payloadDigest,
  };
  return envelope.envelopeId === await contentDigest(identity);
}

export type ArtifactEnvelopeParseResult =
  | { readonly ok: true; readonly envelope: ArtifactEnvelopeV1 }
  | { readonly ok: false; readonly error: string };

const KINDS = new Set<EverythingRingsArtifactKind>([
  "measurement", "derivation", "atlas-record", "atlas-snapshot", "atlas-collection",
  "station-calibration-protocol", "station-calibration-verdict", "sonic-twin-benchmark", "software-qualification",
]);

export async function parseArtifactEnvelope(value: unknown): Promise<ArtifactEnvelopeParseResult> {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("artifact envelope must be an object");
    const record = value as Record<string, unknown>;
    if (record.schemaVersion !== 1) throw new Error("artifact envelope schemaVersion must be 1");
    if (record.envelopeContractVersion !== "everything-rings-artifact-envelope-1") throw new Error("artifact envelope contract mismatch");
    if (typeof record.artifactKind !== "string" || !KINDS.has(record.artifactKind as EverythingRingsArtifactKind)) throw new Error("artifactKind is invalid");
    if (typeof record.artifactContractVersion !== "string" || record.artifactContractVersion.trim().length === 0) throw new Error("artifactContractVersion is required");
    if (typeof record.createdAt !== "string" || !Number.isFinite(Date.parse(record.createdAt))) throw new Error("createdAt is invalid");
    if (typeof record.payloadDigest !== "string" || typeof record.envelopeId !== "string") throw new Error("artifact envelope digests are required");
    const envelope = record as unknown as ArtifactEnvelopeV1;
    if (!await verifyArtifactEnvelope(envelope)) throw new Error("artifact envelope content digest verification failed");
    return { ok: true, envelope };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function parseArtifactEnvelopeJson(json: string): Promise<ArtifactEnvelopeParseResult> {
  try {
    return parseArtifactEnvelope(JSON.parse(json) as unknown);
  } catch (error) {
    return { ok: false, error: `invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export interface ArtifactMigrationStepV1 {
  readonly artifactKind: EverythingRingsArtifactKind;
  readonly fromContractVersion: string;
  readonly toContractVersion: string;
  readonly migrate: (payload: unknown) => unknown;
}

export class ArtifactMigrationRegistryV1 {
  private readonly steps = new Map<string, ArtifactMigrationStepV1>();

  register(step: ArtifactMigrationStepV1): void {
    if (step.fromContractVersion === step.toContractVersion) throw new Error("migration must change contract version");
    const key = `${step.artifactKind}\u0000${step.fromContractVersion}`;
    if (this.steps.has(key)) throw new Error(`duplicate migration from ${step.artifactKind}/${step.fromContractVersion}`);
    this.steps.set(key, step);
  }

  migrate(artifactKind: EverythingRingsArtifactKind, fromVersion: string, targetVersion: string, payload: unknown): unknown {
    let currentVersion = fromVersion;
    let currentPayload = payload;
    const visited = new Set<string>();
    while (currentVersion !== targetVersion) {
      const marker = `${artifactKind}\u0000${currentVersion}`;
      if (visited.has(marker)) throw new Error("artifact migration cycle detected");
      visited.add(marker);
      const step = this.steps.get(marker);
      if (step === undefined) throw new Error(`no migration path from ${artifactKind}/${currentVersion} to ${targetVersion}`);
      currentPayload = step.migrate(currentPayload);
      currentVersion = step.toContractVersion;
    }
    return currentPayload;
  }
}
