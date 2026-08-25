import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { contentDigest, createAtlasRecord } from "@everything-rings/validation";
import { describe, expect, it } from "vitest";
import { artifactContainsPcm } from "../src/pcm";
import { AtlasApiError, PersistentResonanceAtlasServiceV1 } from "../src/service";
import { FileByteStore, MemoryByteStore } from "../src/store";

async function record(specimenId: string, seed: string) {
  return createAtlasRecord({
    createdAt: "2026-08-24T16:00:00.000Z",
    contributor: { contributorId: "persist", displayName: null },
    specimen: { specimenId, label: specimenId, objectFamily: "digital", material: "other", publicDescription: "persist fixture" },
    measurements: [{ measurementId: await contentDigest({ seed }), derivationIds: [] }],
  });
}

describe("persistent Atlas adapter", () => {
  it("is idempotent, readable, and snapshot-capable", async () => {
    const service = new PersistentResonanceAtlasServiceV1(new MemoryByteStore());
    const published = await record("persist-a", "a");
    expect(await service.publish(published)).toEqual({ inserted: true, atlasRecordId: published.atlasRecordId });
    expect(await service.publish(published)).toEqual({ inserted: false, atlasRecordId: published.atlasRecordId });
    expect(await service.get(published.atlasRecordId)).toEqual(published);
    const snapshot = await service.snapshot("2026-08-24T16:59:00.000Z");
    expect(snapshot.recordIds).toEqual([published.atlasRecordId]);
  });

  it("rejects PCM in PCM-free artifacts", async () => {
    const service = new PersistentResonanceAtlasServiceV1(new MemoryByteStore());
    const published = await record("pcm-a", "pcm");
    const poisoned = { ...published, samples: [0.1, -0.2, 0.3] };
    await expect(service.publish(poisoned)).rejects.toMatchObject({ code: "pcm-rejected" } satisfies Partial<AtlasApiError>);
    expect(artifactContainsPcm({ rawMicrophoneSamplesIncluded: true })).toBe(true);
    expect(artifactContainsPcm({ rawMicrophoneSamplesIncluded: false })).toBe(false);
  });

  it("rejects digest mismatch and malformed artifacts", async () => {
    const service = new PersistentResonanceAtlasServiceV1(new MemoryByteStore());
    const published = await record("bad-a", "bad");
    const mismatch = { ...published, atlasRecordId: await contentDigest({ other: true }) };
    await expect(service.publish(mismatch)).rejects.toMatchObject({ code: "digest-mismatch" } satisfies Partial<AtlasApiError>);
    await expect(service.publish({ not: "an atlas record" } as never)).rejects.toBeInstanceOf(AtlasApiError);
  });

  it("survives restart without mutating immutable bytes", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "atlas-durable-"));
    try {
      const first = new PersistentResonanceAtlasServiceV1(new FileByteStore(directory));
      const published = await record("file-a", "restart");
      await first.publish(published);
      await first.snapshot("2026-08-24T16:59:00.000Z");
      const file = path.join(directory, "immutable", "records", `${published.atlasRecordId.replace(":", "-")}.json`);
      const original = await readFile(file);
      const second = new PersistentResonanceAtlasServiceV1(new FileByteStore(directory));
      expect(await second.get(published.atlasRecordId)).toEqual(published);
      expect(await second.count()).toBe(1);
      expect(await second.publish(published)).toEqual({ inserted: false, atlasRecordId: published.atlasRecordId });
      expect(await readFile(file)).toEqual(original);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("serializes concurrent idempotent publishes", async () => {
    const service = new PersistentResonanceAtlasServiceV1(new MemoryByteStore());
    const published = await record("race-a", "race");
    const results = await Promise.all([service.publish(published), service.publish(published), service.publish(published)]);
    expect(results.filter((result) => result.inserted)).toHaveLength(1);
    expect(await service.count()).toBe(1);
  });
});
