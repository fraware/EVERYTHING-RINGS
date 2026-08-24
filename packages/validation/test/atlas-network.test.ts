import { describe, expect, it } from "vitest";
import {
  buildAtlasGraph,
  contentDigest,
  createAtlasCollection,
  createAtlasRecord,
  emptyAtlasRegistry,
  publishAtlasRecord,
  verifyAtlasCollection,
} from "../src";

describe("Atlas collection and graph model", () => {
  it("projects verified public records and collections into an explicit non-identity graph", async () => {
    const first = await createAtlasRecord({
      createdAt: "2026-08-24T16:00:00.000Z",
      contributor: { contributorId: "alice", displayName: "Alice" },
      specimen: { specimenId: "spec-a", label: "Digital Bell", objectFamily: "bell", material: "other", publicDescription: null },
      measurements: [{ measurementId: await contentDigest({ m: "a" }), derivationIds: [] }],
    });
    const second = await createAtlasRecord({
      createdAt: "2026-08-24T16:01:00.000Z",
      contributor: { contributorId: "bob", displayName: "Bob" },
      specimen: { specimenId: "spec-b", label: "Digital Plate", objectFamily: "plate", material: "other", publicDescription: null },
      measurements: [{ measurementId: await contentDigest({ m: "b" }), derivationIds: [] }],
    });
    let registry = await publishAtlasRecord(emptyAtlasRegistry(), first);
    registry = await publishAtlasRecord(registry, second);
    const collection = await createAtlasCollection({
      createdAt: "2026-08-24T16:02:00.000Z",
      contributorId: "alice",
      title: "Digital resonators",
      description: "Software-only examples",
      atlasRecordIds: [first.atlasRecordId, second.atlasRecordId],
    });
    expect(await verifyAtlasCollection(collection)).toBe(true);
    const graph = await buildAtlasGraph(registry, [collection]);
    expect(graph.nodes.some((node) => node.kind === "collection")).toBe(true);
    expect(graph.edges.filter((edge) => edge.kind === "member-of")).toHaveLength(2);
    expect(graph.edges.filter((edge) => edge.kind === "created-by")).toHaveLength(1);
    expect(graph.edges.every((edge) => edge.kind !== ("same-object" as never))).toBe(true);
  });

  it("rejects tampered collections before graph projection", async () => {
    const record = await createAtlasRecord({
      createdAt: "2026-08-24T16:00:00.000Z",
      contributor: null,
      specimen: { specimenId: "spec-a", label: "A", objectFamily: "bell", material: "other", publicDescription: null },
      measurements: [{ measurementId: await contentDigest({ m: "a" }), derivationIds: [] }],
    });
    const registry = await publishAtlasRecord(emptyAtlasRegistry(), record);
    const collection = await createAtlasCollection({
      createdAt: "2026-08-24T16:02:00.000Z",
      contributorId: "alice",
      title: "Original",
      description: null,
      atlasRecordIds: [record.atlasRecordId],
    });
    const tampered = { ...collection, title: "Changed" };
    expect(await verifyAtlasCollection(tampered)).toBe(false);
    await expect(buildAtlasGraph(registry, [tampered])).rejects.toThrow(/content verification/);
  });
});
