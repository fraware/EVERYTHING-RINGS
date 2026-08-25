import type {
  DerivationRecordV1,
  DerivationRecordV2,
  MeasurementRecordV1,
  ResearchBenchmarkSnapshotV1,
  ResearchRepositoryStateV1,
} from "@everything-rings/validation";

export type LineageArtifactKind =
  | "measurement-record-1"
  | "derivation-record-1"
  | "derivation-record-2"
  | "research-benchmark-snapshot-1"
  | "unknown"
  | "missing";

export interface LineageEdge {
  readonly relation:
    | "measurementId"
    | "sourceMeasurementIds"
    | "sourceDerivationIds"
    | "sourceDatasetSnapshotIds";
  readonly id: string;
}

export interface LineageNode {
  readonly id: string;
  readonly kind: LineageArtifactKind;
  readonly present: boolean;
  readonly contractVersion: string | null;
  readonly recordKind: string | null;
  readonly edges: readonly LineageEdge[];
}

export interface LineageGraphIndex {
  readonly measurements: ReadonlyMap<string, MeasurementRecordV1>;
  readonly derivationsV1: ReadonlyMap<string, DerivationRecordV1>;
  readonly derivationsV2: ReadonlyMap<string, DerivationRecordV2>;
  readonly snapshots: ReadonlyMap<string, ResearchBenchmarkSnapshotV1>;
}

export function emptyLineageGraphIndex(): LineageGraphIndex {
  return {
    measurements: new Map(),
    derivationsV1: new Map(),
    derivationsV2: new Map(),
    snapshots: new Map(),
  };
}

export function indexFromRepository(repository: ResearchRepositoryStateV1): LineageGraphIndex {
  const measurements = new Map<string, MeasurementRecordV1>();
  const derivationsV1 = new Map<string, DerivationRecordV1>();
  for (const measurement of repository.measurements) {
    measurements.set(measurement.measurementId, measurement);
  }
  for (const derivation of repository.derivations) {
    derivationsV1.set(derivation.derivationId, derivation);
  }
  return {
    measurements,
    derivationsV1,
    derivationsV2: new Map(),
    snapshots: new Map(),
  };
}

export function mergeLineageIndexes(...indexes: readonly LineageGraphIndex[]): LineageGraphIndex {
  const out = emptyLineageGraphIndex();
  const measurements = new Map(out.measurements);
  const derivationsV1 = new Map(out.derivationsV1);
  const derivationsV2 = new Map(out.derivationsV2);
  const snapshots = new Map(out.snapshots);
  for (const index of indexes) {
    for (const [id, value] of index.measurements) measurements.set(id, value);
    for (const [id, value] of index.derivationsV1) derivationsV1.set(id, value);
    for (const [id, value] of index.derivationsV2) derivationsV2.set(id, value);
    for (const [id, value] of index.snapshots) snapshots.set(id, value);
  }
  return { measurements, derivationsV1, derivationsV2, snapshots };
}

export function indexDerivation(record: DerivationRecordV1 | DerivationRecordV2): LineageGraphIndex {
  const base = emptyLineageGraphIndex();
  if (record.derivationContractVersion === "derivation-record-1") {
    return {
      ...base,
      derivationsV1: new Map([[record.derivationId, record]]),
    };
  }
  return {
    ...base,
    derivationsV2: new Map([[record.derivationId, record]]),
  };
}

export function indexSnapshot(snapshot: ResearchBenchmarkSnapshotV1): LineageGraphIndex {
  return {
    ...emptyLineageGraphIndex(),
    snapshots: new Map([[snapshot.snapshotId, snapshot]]),
  };
}

export function indexMeasurement(measurement: MeasurementRecordV1): LineageGraphIndex {
  return {
    ...emptyLineageGraphIndex(),
    measurements: new Map([[measurement.measurementId, measurement]]),
  };
}

export function isDerivationRecordV1(value: unknown): value is DerivationRecordV1 {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === 1
    && record.derivationContractVersion === "derivation-record-1"
    && typeof record.derivationId === "string";
}

export function isDerivationRecordV2(value: unknown): value is DerivationRecordV2 {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === 2
    && record.derivationContractVersion === "derivation-record-2"
    && typeof record.derivationId === "string"
    && Array.isArray(record.sourceMeasurementIds)
    && Array.isArray(record.sourceDerivationIds)
    && Array.isArray(record.sourceDatasetSnapshotIds);
}

export function isMeasurementRecord(value: unknown): value is MeasurementRecordV1 {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === 1
    && record.measurementContractVersion === "measurement-record-1"
    && typeof record.measurementId === "string";
}

export function isResearchBenchmarkSnapshot(value: unknown): value is ResearchBenchmarkSnapshotV1 {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === 1
    && record.benchmarkSnapshotContractVersion === "research-benchmark-snapshot-1"
    && typeof record.snapshotId === "string"
    && Array.isArray(record.membershipObservationIds);
}

export function isResearchRepository(value: unknown): value is ResearchRepositoryStateV1 {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1 || record.repositoryContractVersion !== "everything-rings-research-repository-1") return false;
  if (!Array.isArray(record.measurements) || !Array.isArray(record.derivations)) return false;
  if (typeof record.atlas !== "object" || record.atlas === null) return false;
  return true;
}

/**
 * Accept either a research repository or a loose lineage bundle
 * `{ measurements?, derivations?, snapshots? }`.
 */
export function indexFromUnknownGraph(value: unknown): LineageGraphIndex | null {
  if (isResearchRepository(value)) return indexFromRepository(value);
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const measurements = new Map<string, MeasurementRecordV1>();
  const derivationsV1 = new Map<string, DerivationRecordV1>();
  const derivationsV2 = new Map<string, DerivationRecordV2>();
  const snapshots = new Map<string, ResearchBenchmarkSnapshotV1>();
  let recognized = false;
  if (Array.isArray(record.measurements)) {
    recognized = true;
    for (const item of record.measurements) {
      if (isMeasurementRecord(item)) measurements.set(item.measurementId, item);
    }
  }
  if (Array.isArray(record.derivations)) {
    recognized = true;
    for (const item of record.derivations) {
      if (isDerivationRecordV1(item)) derivationsV1.set(item.derivationId, item);
      else if (isDerivationRecordV2(item)) derivationsV2.set(item.derivationId, item);
    }
  }
  if (Array.isArray(record.snapshots)) {
    recognized = true;
    for (const item of record.snapshots) {
      if (isResearchBenchmarkSnapshot(item)) snapshots.set(item.snapshotId, item);
    }
  }
  if (!recognized) return null;
  return { measurements, derivationsV1, derivationsV2, snapshots };
}

export function nodeEdges(id: string, index: LineageGraphIndex): LineageNode {
  const measurement = index.measurements.get(id);
  if (measurement !== undefined) {
    return {
      id,
      kind: "measurement-record-1",
      present: true,
      contractVersion: measurement.measurementContractVersion,
      recordKind: null,
      edges: [],
    };
  }
  const v1 = index.derivationsV1.get(id);
  if (v1 !== undefined) {
    return {
      id,
      kind: "derivation-record-1",
      present: true,
      contractVersion: v1.derivationContractVersion,
      recordKind: v1.kind,
      edges: [{ relation: "measurementId", id: v1.measurementId }],
    };
  }
  const v2 = index.derivationsV2.get(id);
  if (v2 !== undefined) {
    return {
      id,
      kind: "derivation-record-2",
      present: true,
      contractVersion: v2.derivationContractVersion,
      recordKind: v2.kind,
      edges: [
        ...v2.sourceMeasurementIds.map((sourceId) => ({ relation: "sourceMeasurementIds" as const, id: sourceId })),
        ...v2.sourceDerivationIds.map((sourceId) => ({ relation: "sourceDerivationIds" as const, id: sourceId })),
        ...v2.sourceDatasetSnapshotIds.map((sourceId) => ({ relation: "sourceDatasetSnapshotIds" as const, id: sourceId })),
      ],
    };
  }
  const snapshot = index.snapshots.get(id);
  if (snapshot !== undefined) {
    return {
      id,
      kind: "research-benchmark-snapshot-1",
      present: true,
      contractVersion: snapshot.benchmarkSnapshotContractVersion,
      recordKind: null,
      edges: [],
    };
  }
  return {
    id,
    kind: "missing",
    present: false,
    contractVersion: null,
    recordKind: null,
    edges: [],
  };
}

export interface LineageWalkNode extends LineageNode {
  readonly depth: number;
  readonly cycle: boolean;
  readonly sources: readonly LineageWalkNode[];
}

export function walkLineage(rootId: string, index: LineageGraphIndex, maxDepth = 32): LineageWalkNode {
  const visiting = new Set<string>();

  function walk(id: string, depth: number): LineageWalkNode {
    const node = nodeEdges(id, index);
    if (visiting.has(id)) {
      return { ...node, depth, cycle: true, sources: [] };
    }
    if (depth >= maxDepth) {
      return { ...node, depth, cycle: false, sources: [] };
    }
    visiting.add(id);
    const sources = node.edges.map((edge) => walk(edge.id, depth + 1));
    visiting.delete(id);
    return { ...node, depth, cycle: false, sources };
  }

  return walk(rootId, 0);
}
