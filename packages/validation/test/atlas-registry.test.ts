import { describe, expect, it } from "vitest";
import {
  applyAtlasSpecimenMerge,
  contentDigest,
  createAtlasRecord,
  createAtlasSpecimenMerge,
  emptyAtlasRegistry,
  publishAtlasRecord,
  searchAtlas,
  snapshotAtlasRegistry,
  verifyAtlasSpecimenMerge,
} from "../src";

async function atlasRecord(specimenId: string, label: string, measurementSeed: string) {
  return createAtlasRecord({
    createdAt: "2026-08-24T15:30:00.000Z",
    contributor: { contributorId: "contributor-1", displayName: null },
    specimen: {
      specimenId,
      label,
      objectFamily: "digital-reference",
      material: "other",
      publicDescription: "software qualification record",
    },
    measurements: [{ measurementId: await contentDigest({ measurementSeed }), derivationIds: [] }],
  });
}

describe("Resonance Atlas registry", () => {
  it("publishes verified records append-only and creates deterministic snapshots", async () => {
    const first = await atlasRecord("specimen-a", "Digital Bell A", "a");
    const second = await atlasRecord("specimen-b", "Digital Bell B", "b");
    let registry = emptyAtlasRegistry();
    registry = await publishAtlasRecord(registry, first);
    registry = await publishAtlasRecord(registry, second);
    expect(registry.records).toHaveLength(2);
    const repeated = await publishAtlasRecord(registry, first);
    expect(repeated.records).toHaveLength(2);

    const results = searchAtlas(registry, { text: "bell", material: "other" });
    expect(results).toHaveLength(2);
    const snapshot = await snapshotAtlasRegistry(registry, "2026-08-24T16:00:00.000Z");
    expect(snapshot.recordIds).toHaveLength(2);
    expect(snapshot.snapshotId).toMatch(/^sha256:/);
  });

  it("prevents one immutable measurement from being published under two specimens", async () => {
    const measurementId = await contentDigest({ same: "measurement" });
    const first = await createAtlasRecord({
      createdAt: "2026-08-24T15:30:00.000Z",
      contributor: null,
      specimen: { specimenId: "specimen-a", label: "A", objectFamily: "bell", material: "other", publicDescription: null },
      measurements: [{ measurementId, derivationIds: [] }],
    });
    const second = await createAtlasRecord({
      createdAt: "2026-08-24T15:31:00.000Z",
      contributor: null,
      specimen: { specimenId: "specimen-b", label: "B", objectFamily: "bell", material: "other", publicDescription: null },
      measurements: [{ measurementId, derivationIds: [] }],
    });
    const registry = await publishAtlasRecord(emptyAtlasRegistry(), first);
    await expect(publishAtlasRecord(registry, second)).rejects.toThrow(/another specimen/);
  });

  it("supports verified evidence-backed specimen merges without rewriting historical records", async () => {
    const first = await atlasRecord("alias-a", "Alias A", "a");
    const second = await atlasRecord("canonical-a", "Canonical A", "b");
    let registry = await publishAtlasRecord(emptyAtlasRegistry(), first);
    registry = await publishAtlasRecord(registry, second);
    const merge = await createAtlasSpecimenMerge({
      createdAt: "2026-08-24T16:05:00.000Z",
      aliasSpecimenId: "alias-a",
      canonicalSpecimenId: "canonical-a",
      rationale: "software test of explicit merge policy",
      supportingRecordIds: [first.atlasRecordId, second.atlasRecordId],
    });
    expect(await verifyAtlasSpecimenMerge(merge)).toBe(true);
    registry = await applyAtlasSpecimenMerge(registry, merge);
    expect(registry.records).toHaveLength(2);
    expect(registry.specimenMerges).toHaveLength(1);
    const alias = searchAtlas(registry, { text: "Alias" })[0];
    expect(alias?.canonicalSpecimenId).toBe("canonical-a");
  });

  it("rejects a content-tampered merge", async () => {
    const first = await atlasRecord("alias-a", "Alias A", "a");
    const second = await atlasRecord("canonical-a", "Canonical A", "b");
    let registry = await publishAtlasRecord(emptyAtlasRegistry(), first);
    registry = await publishAtlasRecord(registry, second);
    const merge = await createAtlasSpecimenMerge({
      createdAt: "2026-08-24T16:05:00.000Z",
      aliasSpecimenId: "alias-a",
      canonicalSpecimenId: "canonical-a",
      rationale: "original rationale",
      supportingRecordIds: [first.atlasRecordId, second.atlasRecordId],
    });
    const tampered = { ...merge, rationale: "mutated after signing" };
    expect(await verifyAtlasSpecimenMerge(tampered)).toBe(false);
    await expect(applyAtlasSpecimenMerge(registry, tampered)).rejects.toThrow(/content verification/);
  });
});
