import { describe, expect, it } from "vitest";
import {
  contentDigest,
  createAtlasRecord,
  createAtlasSnapshot,
  verifyAtlasRecord,
} from "../src";

describe("Resonance Atlas provenance schema", () => {
  it("publishes only content-addressed measurement references with explicit consent", async () => {
    const measurementId = await contentDigest({ measurement: 1 });
    const derivationId = await contentDigest({ renderer: 1 });
    const record = await createAtlasRecord({
      createdAt: "2026-08-24T15:00:00.000Z",
      contributor: { contributorId: "contributor-001", displayName: null },
      specimen: {
        specimenId: "specimen-001",
        label: "Digital twin specimen",
        objectFamily: "reference-object",
        material: "unknown",
        publicDescription: "Synthetic validation specimen",
      },
      measurements: [{ measurementId, derivationIds: [derivationId] }],
    });
    expect(record.rawMicrophoneSamplesIncluded).toBe(false);
    expect(record.publicationConsent).toBe(true);
    expect(record.atlasRecordId).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(await verifyAtlasRecord(record)).toBe(true);
  });

  it("builds deterministic corpus snapshots from a canonical record set", async () => {
    const ids = [await contentDigest({ record: 2 }), await contentDigest({ record: 1 })];
    const first = await createAtlasSnapshot(ids, "2026-08-24T16:00:00.000Z");
    const second = await createAtlasSnapshot([...ids].reverse(), "2026-08-24T16:00:00.000Z");
    expect(first).toEqual(second);
    expect(first.recordIds).toEqual([...ids].sort());
  });
});
