import type { MaterialClass } from "./types";
import { contentDigest } from "./provenance";

export interface AtlasContributorV1 {
  readonly contributorId: string;
  readonly displayName: string | null;
}

export interface AtlasSpecimenV1 {
  readonly specimenId: string;
  readonly label: string;
  readonly objectFamily: string;
  readonly material: MaterialClass | "unknown";
  readonly publicDescription: string | null;
}

export interface AtlasMeasurementReferenceV1 {
  readonly measurementId: string;
  readonly derivationIds: readonly string[];
}

export interface ResonanceAtlasRecordV1 {
  readonly schemaVersion: 1;
  readonly atlasContractVersion: "resonance-atlas-record-1";
  readonly atlasRecordId: string;
  readonly createdAt: string;
  readonly contributor: AtlasContributorV1 | null;
  readonly specimen: AtlasSpecimenV1;
  readonly measurements: readonly AtlasMeasurementReferenceV1[];
  readonly rawMicrophoneSamplesIncluded: false;
  readonly publicationConsent: true;
}

export interface ResonanceAtlasSnapshotV1 {
  readonly schemaVersion: 1;
  readonly snapshotContractVersion: "resonance-atlas-snapshot-1";
  readonly createdAt: string;
  readonly recordIds: readonly string[];
  readonly snapshotId: string;
}

function assertDigest(value: string, field: string): void {
  if (!/^sha256:[0-9a-f]{64}$/.test(value)) throw new Error(`${field} must be a sha256 content digest`);
}

export async function createAtlasRecord(
  input: Omit<ResonanceAtlasRecordV1, "schemaVersion" | "atlasContractVersion" | "atlasRecordId" | "rawMicrophoneSamplesIncluded" | "publicationConsent">,
): Promise<ResonanceAtlasRecordV1> {
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("Atlas record createdAt is invalid");
  if (input.specimen.specimenId.trim().length === 0) throw new Error("Atlas specimenId is required");
  if (input.specimen.label.trim().length === 0) throw new Error("Atlas specimen label is required");
  if (input.measurements.length === 0) throw new Error("Atlas record requires at least one measurement reference");
  const seen = new Set<string>();
  for (const measurement of input.measurements) {
    assertDigest(measurement.measurementId, "measurementId");
    if (seen.has(measurement.measurementId)) throw new Error("Atlas record contains a duplicate measurement reference");
    seen.add(measurement.measurementId);
    measurement.derivationIds.forEach((digest) => assertDigest(digest, "derivationId"));
  }
  const payload = {
    ...input,
    schemaVersion: 1 as const,
    atlasContractVersion: "resonance-atlas-record-1" as const,
    rawMicrophoneSamplesIncluded: false as const,
    publicationConsent: true as const,
  };
  const atlasRecordId = await contentDigest(payload);
  return { ...payload, atlasRecordId };
}

export async function createAtlasSnapshot(
  recordIds: readonly string[],
  createdAt: string,
): Promise<ResonanceAtlasSnapshotV1> {
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error("Atlas snapshot createdAt is invalid");
  if (recordIds.length === 0) throw new Error("Atlas snapshot requires at least one record");
  const canonicalIds = [...new Set(recordIds)].sort();
  canonicalIds.forEach((digest) => assertDigest(digest, "atlasRecordId"));
  const payload = {
    schemaVersion: 1 as const,
    snapshotContractVersion: "resonance-atlas-snapshot-1" as const,
    createdAt,
    recordIds: canonicalIds,
  };
  return { ...payload, snapshotId: await contentDigest(payload) };
}

export async function verifyAtlasRecord(record: ResonanceAtlasRecordV1): Promise<boolean> {
  const { atlasRecordId, ...payload } = record;
  if (record.rawMicrophoneSamplesIncluded !== false || record.publicationConsent !== true) return false;
  return atlasRecordId === await contentDigest(payload);
}
