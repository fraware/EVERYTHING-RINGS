import type { ResonanceAtlasRecordV1, ResonanceAtlasSnapshotV1 } from "./atlas";
import {
  emptyAtlasRegistry,
  publishAtlasRecord,
  searchAtlas,
  snapshotAtlasRegistry,
  type AtlasRegistryStateV1,
  type AtlasSearchQueryV1,
  type AtlasSearchResultV1,
} from "./atlas-registry";

export interface ResonanceAtlasServiceV1 {
  readonly serviceContractVersion: "resonance-atlas-service-1";
  publish(record: ResonanceAtlasRecordV1): Promise<{ readonly inserted: boolean; readonly atlasRecordId: string }>;
  get(atlasRecordId: string): Promise<ResonanceAtlasRecordV1 | null>;
  search(query: AtlasSearchQueryV1): Promise<readonly AtlasSearchResultV1[]>;
  snapshot(createdAt: string): Promise<ResonanceAtlasSnapshotV1>;
  count(): Promise<number>;
}

/**
 * Deterministic reference adapter for tests, local research tools, and contract
 * conformance. A production network service can implement the same interface.
 */
export class MemoryResonanceAtlasServiceV1 implements ResonanceAtlasServiceV1 {
  readonly serviceContractVersion = "resonance-atlas-service-1" as const;
  private state: AtlasRegistryStateV1 = emptyAtlasRegistry();

  async publish(record: ResonanceAtlasRecordV1): Promise<{ readonly inserted: boolean; readonly atlasRecordId: string }> {
    const before = this.state.records.length;
    this.state = await publishAtlasRecord(this.state, record);
    return { inserted: this.state.records.length > before, atlasRecordId: record.atlasRecordId };
  }

  async get(atlasRecordId: string): Promise<ResonanceAtlasRecordV1 | null> {
    return this.state.records.find((record) => record.atlasRecordId === atlasRecordId) ?? null;
  }

  async search(query: AtlasSearchQueryV1): Promise<readonly AtlasSearchResultV1[]> {
    return searchAtlas(this.state, query);
  }

  async snapshot(createdAt: string): Promise<ResonanceAtlasSnapshotV1> {
    return snapshotAtlasRegistry(this.state, createdAt);
  }

  async count(): Promise<number> {
    return this.state.records.length;
  }

  exportState(): AtlasRegistryStateV1 {
    return {
      ...this.state,
      records: [...this.state.records],
      specimenMerges: [...this.state.specimenMerges],
    };
  }
}

export async function verifyAtlasServiceConformance(
  service: ResonanceAtlasServiceV1,
  records: readonly ResonanceAtlasRecordV1[],
): Promise<{ readonly passed: boolean; readonly reasons: readonly string[] }> {
  const reasons: string[] = [];
  for (const record of records) {
    const first = await service.publish(record);
    const second = await service.publish(record);
    if (!first.inserted) reasons.push(`first publication of ${record.atlasRecordId} was not inserted`);
    if (second.inserted) reasons.push(`duplicate publication of ${record.atlasRecordId} was not idempotent`);
    const fetched = await service.get(record.atlasRecordId);
    if (fetched?.atlasRecordId !== record.atlasRecordId) reasons.push(`record ${record.atlasRecordId} could not be read back`);
  }
  if (await service.count() !== new Set(records.map((record) => record.atlasRecordId)).size) reasons.push("service count disagrees with unique published records");
  if (records.length > 0) {
    const snapshot = await service.snapshot("2026-08-24T16:59:00.000Z");
    if (snapshot.recordIds.length !== new Set(records.map((record) => record.atlasRecordId)).size) reasons.push("service snapshot omitted published records");
  }
  return { passed: reasons.length === 0, reasons };
}
