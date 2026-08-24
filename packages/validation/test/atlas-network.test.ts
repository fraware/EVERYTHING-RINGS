import { describe, expect, it } from "vitest";
import {
  buildAtlasGraph,
  contentDigest,
  createAtlasCollection,
  createAtlasRecord,
  emptyAtlasRegistry,
  publishAtlasRecord,
} from "../src";

describe("Atlas collection and graph model", () => {
  it("projects public records and collections into an explicit non-identity graph", async () => {
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
    const graph = buildAtlasGraph(registry, [collection]);
    expect(graph.nodes.some((node) => node.kind === "collection")).toBe(true);
    expect(graph.edges.filter((edge) => edge.kind === "member-of")).toHaveLength(2);
    expect(graph.edges.every((edge) => edge.kind !== ("same-object" as never))).toBe(true);
  });
});
