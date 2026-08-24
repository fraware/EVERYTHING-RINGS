import {
  publishAtlasRecord,
  type AtlasRegistryStateV1,
  emptyAtlasRegistry,
} from "./atlas-registry";
import type { ResonanceAtlasRecordV1 } from "./atlas";
import {
  verifyDerivationRecord,
  verifyMeasurementRecord,
  type DerivationRecordV1,
  type MeasurementRecordV1,
} from "./provenance";

export interface ResearchRepositoryStateV1 {
  readonly schemaVersion: 1;
  readonly repositoryContractVersion: "everything-rings-research-repository-1";
  readonly measurements: readonly MeasurementRecordV1[];
  readonly derivations: readonly DerivationRecordV1[];
  readonly atlas: AtlasRegistryStateV1;
}

export function emptyResearchRepository(): ResearchRepositoryStateV1 {
  return {
    schemaVersion: 1,
    repositoryContractVersion: "everything-rings-research-repository-1",
    measurements: [],
    derivations: [],
    atlas: emptyAtlasRegistry(),
  };
}

export async function ingestMeasurement(
  state: ResearchRepositoryStateV1,
  measurement: MeasurementRecordV1,
): Promise<ResearchRepositoryStateV1> {
  if (!await verifyMeasurementRecord(measurement)) throw new Error("measurement failed content verification");
  const existing = state.measurements.find((candidate) => candidate.measurementId === measurement.measurementId);
  if (existing !== undefined) return state;
  return {
    ...state,
    measurements: [...state.measurements, measurement].sort((left, right) => left.measurementId.localeCompare(right.measurementId)),
  };
}

export async function ingestDerivation(
  state: ResearchRepositoryStateV1,
  derivation: DerivationRecordV1,
): Promise<ResearchRepositoryStateV1> {
  if (!await verifyDerivationRecord(derivation)) throw new Error("derivation failed content verification");
  if (!state.measurements.some((measurement) => measurement.measurementId === derivation.measurementId)) {
    throw new Error("derivation root measurement is absent from repository");
  }
  if (state.derivations.some((candidate) => candidate.derivationId === derivation.derivationId)) return state;
  return {
    ...state,
    derivations: [...state.derivations, derivation].sort((left, right) => left.derivationId.localeCompare(right.derivationId)),
  };
}

export async function publishRepositoryAtlasRecord(
  state: ResearchRepositoryStateV1,
  record: ResonanceAtlasRecordV1,
): Promise<ResearchRepositoryStateV1> {
  for (const reference of record.measurements) {
    if (!state.measurements.some((measurement) => measurement.measurementId === reference.measurementId)) {
      throw new Error(`Atlas measurement ${reference.measurementId} is absent from repository`);
    }
    for (const derivationId of reference.derivationIds) {
      const derivation = state.derivations.find((candidate) => candidate.derivationId === derivationId);
      if (derivation === undefined) throw new Error(`Atlas derivation ${derivationId} is absent from repository`);
      if (derivation.measurementId !== reference.measurementId) {
        throw new Error(`Atlas derivation ${derivationId} is bound to a different measurement`);
      }
    }
  }
  return { ...state, atlas: await publishAtlasRecord(state.atlas, record) };
}

export interface ResearchRepositoryIntegrityV1 {
  readonly valid: boolean;
  readonly measurementCount: number;
  readonly derivationCount: number;
  readonly atlasRecordCount: number;
  readonly reasons: readonly string[];
}

export async function verifyResearchRepositoryIntegrity(
  state: ResearchRepositoryStateV1,
): Promise<ResearchRepositoryIntegrityV1> {
  const reasons: string[] = [];
  const measurementIds = new Set<string>();
  for (const measurement of state.measurements) {
    if (measurementIds.has(measurement.measurementId)) reasons.push(`duplicate measurement ${measurement.measurementId}`);
    measurementIds.add(measurement.measurementId);
    if (!await verifyMeasurementRecord(measurement)) reasons.push(`measurement ${measurement.measurementId} failed content verification`);
  }
  const derivationIds = new Set<string>();
  for (const derivation of state.derivations) {
    if (derivationIds.has(derivation.derivationId)) reasons.push(`duplicate derivation ${derivation.derivationId}`);
    derivationIds.add(derivation.derivationId);
    if (!await verifyDerivationRecord(derivation)) reasons.push(`derivation ${derivation.derivationId} failed content verification`);
    if (!measurementIds.has(derivation.measurementId)) reasons.push(`derivation ${derivation.derivationId} has missing root measurement`);
  }
  for (const record of state.atlas.records) {
    for (const reference of record.measurements) {
      if (!measurementIds.has(reference.measurementId)) reasons.push(`Atlas record ${record.atlasRecordId} references missing measurement ${reference.measurementId}`);
      for (const derivationId of reference.derivationIds) {
        const derivation = state.derivations.find((candidate) => candidate.derivationId === derivationId);
        if (derivation === undefined) reasons.push(`Atlas record ${record.atlasRecordId} references missing derivation ${derivationId}`);
        else if (derivation.measurementId !== reference.measurementId) reasons.push(`Atlas derivation ${derivationId} points to wrong measurement`);
      }
    }
  }
  return {
    valid: reasons.length === 0,
    measurementCount: state.measurements.length,
    derivationCount: state.derivations.length,
    atlasRecordCount: state.atlas.records.length,
    reasons: [...new Set(reasons)],
  };
}
