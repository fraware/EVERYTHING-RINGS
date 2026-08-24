import { describe, expect, it } from "vitest";
import { contentDigest, createAtlasRecord, MemoryResonanceAtlasServiceV1, verifyAtlasServiceConformance } from "../src";

async function record(specimenId: string, seed: string) {
  return createAtlasRecord({
    createdAt: "2026-08-24T16:00:00.000Z",
    contributor: { contributorId: "service-test", displayName: null },
    specimen: { specimenId, label: specimenId, objectFamily: "digital", material: "other", publicDescription: "service conformance fixture" },
    measurements: [{ measurementId: await contentDigest({ seed }), derivationIds: [] }],
  });
}

describe("Resonance Atlas service contract", () => {
  it("is idempotent, readable, searchable, and snapshot-capable", async () => {
    const service = new MemoryResonanceAtlasServiceV1();
    const records = [await record("service-a", "a"), await record("service-b", "b")];
    const report = await verifyAtlasServiceConformance(service, records);
    expect(report.passed).toBe(true);
    expect(await service.count()).toBe(2);
    expect(await service.get(records[0]!.atlasRecordId)).not.toBeNull();
    expect(await service.search({ text: "service" })).toHaveLength(2);
    const snapshot = await service.snapshot("2026-08-24T16:59:00.000Z");
    expect(snapshot.recordIds).toHaveLength(2);
  });
});
