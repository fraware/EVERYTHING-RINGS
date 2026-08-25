import {
  contentDigest,
  createAtlasCollection,
  createAtlasRecord,
  createAtlasSpecimenMerge,
  MemoryResonanceAtlasServiceV1,
  verifyAtlasServiceConformance,
} from "@everything-rings/validation";
import { describe, expect, it } from "vitest";
import {
  createHttpAtlasClient,
  createMemoryAtlasClient,
  HttpResonanceAtlasClientV1,
} from "../src/client";
import { createChallengeDefinition, createCollectionMembership, verifyChallengeDefinition } from "../src/participation";
import { describeAtlasPublicationPreview } from "../src/publication-preview";

async function record(specimenId: string, seed: string) {
  return createAtlasRecord({
    createdAt: "2026-08-24T16:00:00.000Z",
    contributor: { contributorId: "client-test", displayName: null },
    specimen: { specimenId, label: specimenId, objectFamily: "digital", material: "other", publicDescription: "client fixture" },
    measurements: [{ measurementId: await contentDigest({ seed }), derivationIds: [] }],
  });
}

describe("MemoryResonanceAtlasClientV1", () => {
  it("is idempotent, readable, searchable, and snapshot-capable", async () => {
    const client = createMemoryAtlasClient();
    const records = [await record("client-a", "a"), await record("client-b", "b")];
    const report = await verifyAtlasServiceConformance(client, records);
    expect(report.passed).toBe(true);
    expect(await client.get(records[0]!.atlasRecordId)).not.toBeNull();
    const snapshot = await client.snapshot("2026-08-24T16:59:00.000Z");
    expect(snapshot.recordIds).toHaveLength(2);
  });

  it("stores collections as inclusion, not same-object identity", async () => {
    const client = createMemoryAtlasClient();
    const first = await record("bell", "c1");
    const second = await record("plate", "c2");
    await client.publish(first);
    await client.publish(second);
    const collection = await createAtlasCollection({
      createdAt: "2026-08-24T17:00:00.000Z",
      contributorId: "client-test",
      title: "Kitchen ringers",
      description: "Inclusion only",
      atlasRecordIds: [first.atlasRecordId, second.atlasRecordId],
    });
    const published = await client.publishCollection(collection);
    expect(published.inserted).toBe(true);
    expect(await client.publishCollection(collection)).toEqual({ inserted: false, collectionId: collection.collectionId });
    expect(await client.getCollection(collection.collectionId)).toEqual(collection);
    const membership = createCollectionMembership(collection.collectionId, first.atlasRecordId);
    expect(membership.meaning).toBe("included-in-this-collection");
  });

  it("applies explicit specimen merges without rewriting records", async () => {
    const client = createMemoryAtlasClient();
    const alias = await record("alias-x", "mx");
    const canonical = await record("canonical-x", "my");
    await client.publish(alias);
    await client.publish(canonical);
    const merge = await createAtlasSpecimenMerge({
      createdAt: "2026-08-24T17:10:00.000Z",
      aliasSpecimenId: "alias-x",
      canonicalSpecimenId: "canonical-x",
      rationale: "explicit lab merge, not a similarity threshold",
      supportingRecordIds: [alias.atlasRecordId, canonical.atlasRecordId],
    });
    expect((await client.publishSpecimenMerge(merge)).inserted).toBe(true);
    expect((await client.publishSpecimenMerge(merge)).inserted).toBe(false);
    const results = await client.search({ text: "alias" });
    expect(results[0]?.canonicalSpecimenId).toBe("canonical-x");
    expect(await client.get(alias.atlasRecordId)).toEqual(alias);
  });
});

describe("HttpResonanceAtlasClientV1", () => {
  it("maps V1 methods onto the Atlas HTTP envelope", async () => {
    const published = await record("http-a", "http");
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "POST" && url.endsWith("/v1/atlas/records")) {
        return new Response(JSON.stringify({
          contractVersion: "resonance-atlas-record-1",
          httpContractVersion: "resonance-atlas-http-1",
          contentAddress: published.atlasRecordId,
          stage: "alpha-synthetic",
          publicNetwork: false,
          body: { inserted: true, atlasRecordId: published.atlasRecordId },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (method === "GET" && url.includes("/v1/atlas/records/") && !url.endsWith("/v1/atlas/records")) {
        return new Response(JSON.stringify({
          contractVersion: "resonance-atlas-record-1",
          httpContractVersion: "resonance-atlas-http-1",
          contentAddress: published.atlasRecordId,
          stage: "alpha-synthetic",
          publicNetwork: false,
          body: published,
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (method === "GET" && url.includes("/v1/atlas/search")) {
        return new Response(JSON.stringify({
          contractVersion: "resonance-atlas-service-1",
          httpContractVersion: "resonance-atlas-http-1",
          contentAddress: published.atlasRecordId,
          stage: "alpha-synthetic",
          publicNetwork: false,
          body: { results: [{ atlasRecordId: published.atlasRecordId, specimenId: "http-a", canonicalSpecimenId: "http-a", label: "http-a", objectFamily: "digital", material: "other", measurementCount: 1, contributorId: "client-test" }] },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (method === "GET" && url.endsWith("/v1/atlas/records")) {
        return new Response(JSON.stringify({
          contractVersion: "resonance-atlas-service-1",
          httpContractVersion: "resonance-atlas-http-1",
          contentAddress: published.atlasRecordId,
          stage: "alpha-synthetic",
          publicNetwork: false,
          body: { count: 1 },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`unexpected ${method} ${url}`);
    };
    const client = new HttpResonanceAtlasClientV1("http://atlas.test", fetchImpl);
    expect(await client.publish(published)).toEqual({ inserted: true, atlasRecordId: published.atlasRecordId });
    expect(await client.get(published.atlasRecordId)).toEqual(published);
    expect(await client.search({ text: "http" })).toHaveLength(1);
    expect(await client.count()).toBe(1);
  });

  it("returns null for missing records", async () => {
    const client = createHttpAtlasClient("http://atlas.test", async () => new Response("", { status: 404 }));
    expect(await client.get("sha256:0000000000000000000000000000000000000000000000000000000000000000")).toBeNull();
  });
});

describe("participation primitives", () => {
  it("binds challenges to an explicit scientific or playful statement", async () => {
    const challenge = await createChallengeDefinition({
      challengeVersion: "kitchen-rings-1",
      prompt: "Publish one local observation of something in a kitchen.",
      startsAt: "2026-09-01T00:00:00.000Z",
      endsAt: "2026-09-30T00:00:00.000Z",
      allowedArtifactTypes: ["public-observation", "atlas-record"],
      consentRules: {
        publicationRequired: true,
        rawAudioAllowed: false,
        canonicalObjectIdentityRequired: false,
        locationConsentRequiredForGeographicAggregation: false,
      },
      rankingCriteria: "number of consented PCM-free observations; no identity ranking",
      resultStatement: {
        intent: "playful",
        statement: "Playful participation. Results are not physical-object identity evidence and are not a scientific ranking.",
      },
      physicalProtocol: null,
    });
    expect(await verifyChallengeDefinition(challenge)).toBe(true);
    expect(challenge.rankingUsesIdentityOrMaterialInferenceAsTruth).toBe(false);
    expect(challenge.collectionMembershipMeansSamePhysicalObject).toBe(false);
  });
});

describe("publication preview", () => {
  it("keeps raw audio off the device-leaving set", () => {
    const preview = describeAtlasPublicationPreview();
    expect(preview.rawAudioIncludedByDefault).toBe(false);
    expect(preview.canonicalObjectIdentityRequired).toBe(false);
    expect(preview.metadataThatStaysOnDevice.some((item) => item.includes("PCM"))).toBe(true);
  });
});

describe("validation in-memory service still conforms", () => {
  it("passes the inherited MemoryResonanceAtlasServiceV1 harness", async () => {
    const service = new MemoryResonanceAtlasServiceV1();
    const records = [await record("mem-a", "ma"), await record("mem-b", "mb")];
    const report = await verifyAtlasServiceConformance(service, records);
    expect(report.passed).toBe(true);
  });
});
