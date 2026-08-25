import {
  createAtlasSnapshot,
  verifyAtlasRecord,
  type ResonanceAtlasRecordV1,
  type ResonanceAtlasSnapshotV1,
} from "./atlas";
import { contentDigest } from "./provenance";

export interface AtlasSpecimenMergeV1 {
  readonly schemaVersion: 1;
  readonly mergeContractVersion: "atlas-specimen-merge-1";
  readonly mergeId: string;
  readonly createdAt: string;
  readonly aliasSpecimenId: string;
  readonly canonicalSpecimenId: string;
  readonly rationale: string;
  readonly supportingRecordIds: readonly string[];
}

export interface AtlasRegistryStateV1 {
  readonly schemaVersion: 1;
  readonly registryContractVersion: "resonance-atlas-registry-1";
  readonly records: readonly ResonanceAtlasRecordV1[];
  readonly specimenMerges: readonly AtlasSpecimenMergeV1[];
}

export function emptyAtlasRegistry(): AtlasRegistryStateV1 {
  return { schemaVersion: 1, registryContractVersion: "resonance-atlas-registry-1", records: [], specimenMerges: [] };
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function assertDigest(value: string, field: string): void {
  if (!/^sha256:[0-9a-f]{64}$/.test(value)) throw new Error(`${field} must be a sha256 content digest`);
}

export async function publishAtlasRecord(
  state: AtlasRegistryStateV1,
  record: ResonanceAtlasRecordV1,
): Promise<AtlasRegistryStateV1> {
  if (!await verifyAtlasRecord(record)) throw new Error("Atlas record failed content verification");
  if (state.records.some((existing) => existing.atlasRecordId === record.atlasRecordId)) return state;

  const measurementOwner = new Map<string, string>();
  for (const existing of state.records) {
    for (const measurement of existing.measurements) measurementOwner.set(measurement.measurementId, normalized(existing.specimen.specimenId));
  }
  const incomingSpecimen = normalized(record.specimen.specimenId);
  for (const measurement of record.measurements) {
    const owner = measurementOwner.get(measurement.measurementId);
    if (owner !== undefined && owner !== incomingSpecimen) {
      throw new Error(`measurement ${measurement.measurementId} is already published under another specimen`);
    }
  }

  return {
    ...state,
    records: [...state.records, record].sort((left, right) => left.atlasRecordId.localeCompare(right.atlasRecordId)),
  };
}

export async function createAtlasSpecimenMerge(
  input: Omit<AtlasSpecimenMergeV1, "schemaVersion" | "mergeContractVersion" | "mergeId">,
): Promise<AtlasSpecimenMergeV1> {
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("Atlas specimen merge createdAt is invalid");
  if (normalized(input.aliasSpecimenId).length === 0 || normalized(input.canonicalSpecimenId).length === 0) throw new Error("merge specimen IDs are required");
  if (normalized(input.aliasSpecimenId) === normalized(input.canonicalSpecimenId)) throw new Error("merge alias and canonical specimen must differ");
  if (input.rationale.trim().length === 0) throw new Error("merge rationale is required");
  if (input.supportingRecordIds.length === 0) throw new Error("merge requires supporting Atlas records");
  const supportingRecordIds = [...new Set(input.supportingRecordIds)].sort();
  supportingRecordIds.forEach((id) => assertDigest(id, "supportingRecordId"));
  const payload = {
    ...input,
    supportingRecordIds,
    schemaVersion: 1 as const,
    mergeContractVersion: "atlas-specimen-merge-1" as const,
  };
  return { ...payload, mergeId: await contentDigest(payload) };
}

export async function verifyAtlasSpecimenMerge(merge: AtlasSpecimenMergeV1): Promise<boolean> {
  if (merge.schemaVersion !== 1 || merge.mergeContractVersion !== "atlas-specimen-merge-1") return false;
  if (!/^sha256:[0-9a-f]{64}$/.test(merge.mergeId)) return false;
  if (!Number.isFinite(Date.parse(merge.createdAt))) return false;
  if (normalized(merge.aliasSpecimenId).length === 0 || normalized(merge.canonicalSpecimenId).length === 0) return false;
  if (normalized(merge.aliasSpecimenId) === normalized(merge.canonicalSpecimenId)) return false;
  if (merge.rationale.trim().length === 0 || merge.supportingRecordIds.length === 0) return false;
  if (new Set(merge.supportingRecordIds).size !== merge.supportingRecordIds.length) return false;
  if (!merge.supportingRecordIds.every((id) => /^sha256:[0-9a-f]{64}$/.test(id))) return false;
  const { mergeId, ...payload } = merge;
  return mergeId === await contentDigest(payload);
}

function resolveCanonicalSpecimenId(state: AtlasRegistryStateV1, specimenId: string): string {
  let current = normalized(specimenId);
  const visited = new Set<string>();
  while (true) {
    if (visited.has(current)) throw new Error("Atlas specimen merge cycle detected");
    visited.add(current);
    const merge = state.specimenMerges.find((candidate) => normalized(candidate.aliasSpecimenId) === current);
    if (merge === undefined) return current;
    current = normalized(merge.canonicalSpecimenId);
  }
}

export async function applyAtlasSpecimenMerge(
  state: AtlasRegistryStateV1,
  merge: AtlasSpecimenMergeV1,
): Promise<AtlasRegistryStateV1> {
  if (!await verifyAtlasSpecimenMerge(merge)) throw new Error("Atlas specimen merge failed content verification");
  if (state.specimenMerges.some((existing) => existing.mergeId === merge.mergeId)) return state;
  if (state.specimenMerges.some((existing) => normalized(existing.aliasSpecimenId) === normalized(merge.aliasSpecimenId))) {
    throw new Error("Atlas alias specimen already has a canonical merge");
  }
  const records = new Set(state.records.map((record) => record.atlasRecordId));
  for (const recordId of merge.supportingRecordIds) {
    if (!records.has(recordId)) throw new Error(`merge supporting record ${recordId} is absent from the registry`);
  }
  const knownSpecimens = new Set(state.records.map((record) => normalized(record.specimen.specimenId)));
  if (!knownSpecimens.has(normalized(merge.aliasSpecimenId))) throw new Error("merge alias specimen is absent from the registry");
  if (!knownSpecimens.has(normalized(merge.canonicalSpecimenId))) throw new Error("merge canonical specimen is absent from the registry");
  const candidate = { ...state, specimenMerges: [...state.specimenMerges, merge].sort((left, right) => left.mergeId.localeCompare(right.mergeId)) };
  resolveCanonicalSpecimenId(candidate, merge.aliasSpecimenId);
  return candidate;
}

export interface AtlasSearchQueryV1 {
  readonly text?: string;
  readonly material?: string;
  readonly objectFamily?: string;
  readonly contributorId?: string;
}

export interface AtlasSearchResultV1 {
  readonly atlasRecordId: string;
  readonly specimenId: string;
  readonly canonicalSpecimenId: string;
  readonly label: string;
  readonly objectFamily: string;
  readonly material: string;
  readonly measurementCount: number;
  readonly contributorId: string | null;
}

export function searchAtlas(
  state: AtlasRegistryStateV1,
  query: AtlasSearchQueryV1,
): readonly AtlasSearchResultV1[] {
  const text = normalized(query.text ?? "");
  const material = normalized(query.material ?? "");
  const family = normalized(query.objectFamily ?? "");
  const contributor = normalized(query.contributorId ?? "");
  return state.records
    .filter((record) => text.length === 0 || normalized(`${record.specimen.label} ${record.specimen.publicDescription ?? ""} ${record.specimen.objectFamily}`).includes(text))
    .filter((record) => material.length === 0 || normalized(record.specimen.material) === material)
    .filter((record) => family.length === 0 || normalized(record.specimen.objectFamily) === family)
    .filter((record) => contributor.length === 0 || normalized(record.contributor?.contributorId ?? "") === contributor)
    .map((record) => ({
      atlasRecordId: record.atlasRecordId,
      specimenId: record.specimen.specimenId,
      canonicalSpecimenId: resolveCanonicalSpecimenId(state, record.specimen.specimenId),
      label: record.specimen.label,
      objectFamily: record.specimen.objectFamily,
      material: record.specimen.material,
      measurementCount: record.measurements.length,
      contributorId: record.contributor?.contributorId ?? null,
    }))
    .sort((left, right) => left.label.localeCompare(right.label) || left.atlasRecordId.localeCompare(right.atlasRecordId));
}

export async function snapshotAtlasRegistry(
  state: AtlasRegistryStateV1,
  createdAt: string,
): Promise<ResonanceAtlasSnapshotV1> {
  if (state.records.length === 0) throw new Error("cannot snapshot an empty Atlas registry");
  for (const record of state.records) {
    if (!await verifyAtlasRecord(record)) throw new Error(`cannot snapshot invalid Atlas record ${record.atlasRecordId}`);
  }
  for (const merge of state.specimenMerges) {
    if (!await verifyAtlasSpecimenMerge(merge)) throw new Error(`cannot snapshot invalid Atlas merge ${merge.mergeId}`);
  }
  return createAtlasSnapshot(state.records.map((record) => record.atlasRecordId), createdAt);
}
