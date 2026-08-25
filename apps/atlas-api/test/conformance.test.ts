import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { contentDigest, createAtlasRecord, MemoryResonanceAtlasServiceV1, verifyAtlasServiceConformance } from "@everything-rings/validation";
import { describe, expect, it } from "vitest";
import { PersistentResonanceAtlasServiceV1 } from "../src/service";
import { FileByteStore, MemoryByteStore } from "../src/store";

async function record(specimenId: string, seed: string) {
  return createAtlasRecord({
    createdAt: "2026-08-24T16:00:00.000Z",
    contributor: { contributorId: "conformance", displayName: null },
    specimen: { specimenId, label: specimenId, objectFamily: "digital", material: "other", publicDescription: "conformance fixture" },
    measurements: [{ measurementId: await contentDigest({ seed }), derivationIds: [] }],
  });
}

describe("Atlas production conformance harness", () => {
  it("still passes for MemoryResonanceAtlasServiceV1", async () => {
    const records = [await record("mem-a", "ma"), await record("mem-b", "mb")];
    const report = await verifyAtlasServiceConformance(new MemoryResonanceAtlasServiceV1(), records);
    expect(report.passed).toBe(true);
    expect(report.reasons).toEqual([]);
  });

  it("passes for the in-memory persistent adapter", async () => {
    const service = new PersistentResonanceAtlasServiceV1(new MemoryByteStore());
    const records = [await record("persist-a", "pa"), await record("persist-b", "pb")];
    const report = await verifyAtlasServiceConformance(service, records);
    expect(report.passed).toBe(true);
    expect(report.reasons).toEqual([]);
  });

  it("passes for the file-backed persistent adapter", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "atlas-conformance-"));
    try {
      const service = new PersistentResonanceAtlasServiceV1(new FileByteStore(directory));
      const records = [await record("file-a", "fa"), await record("file-b", "fb")];
      const report = await verifyAtlasServiceConformance(service, records);
      expect(report.passed).toBe(true);
      expect(report.reasons).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
