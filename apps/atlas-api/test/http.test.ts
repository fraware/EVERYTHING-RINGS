import { contentDigest, createAtlasCollection, createAtlasRecord, createAtlasSpecimenMerge, verifyAtlasServiceConformance } from "@everything-rings/validation";
import { createChallengeDefinition, createHttpAtlasClient } from "@everything-rings/atlas-client";
import { describe, expect, it } from "vitest";
import { createPublicObservationRecord, createSpecimenMembershipAssertion, createSpecimenRecord } from "@everything-rings/validation";
import { listenAtlasApi } from "../src/http";

async function record(specimenId: string, seed: string) {
  return createAtlasRecord({
    createdAt: "2026-08-24T16:00:00.000Z",
    contributor: { contributorId: "http", displayName: null },
    specimen: { specimenId, label: specimenId, objectFamily: "digital", material: "other", publicDescription: "http fixture" },
    measurements: [{ measurementId: await contentDigest({ seed }), derivationIds: [] }],
  });
}

describe("Atlas HTTP service", () => {
  it("exposes contract version and content address on every response", async () => {
    const { server, url } = await listenAtlasApi();
    try {
      const health = await (await fetch(`${url}/v1/atlas/health`)).json() as { contractVersion: string; contentAddress: string; publicNetwork: boolean; body: { stage: string } };
      expect(health.contractVersion).toBe("resonance-atlas-service-1");
      expect(health.contentAddress).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(health.publicNetwork).toBe(false);
      expect(health.body.stage).toBe("alpha-synthetic");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error !== undefined && error !== null ? reject(error) : resolve());
      });
    }
  });

  it("publishes, reads back, searches, and snapshots through the typed client", async () => {
    const { server, url } = await listenAtlasApi();
    try {
      const client = createHttpAtlasClient(url);
      const records = [await record("http-a", "ha"), await record("http-b", "hb")];
      const report = await verifyAtlasServiceConformance(client, records);
      expect(report.passed).toBe(true);
      const collection = await createAtlasCollection({
        createdAt: "2026-08-24T17:00:00.000Z",
        contributorId: "http",
        title: "Lab inclusion set",
        description: "Membership is inclusion, not same-object identity",
        atlasRecordIds: records.map((item) => item.atlasRecordId),
      });
      expect((await client.publishCollection(collection)).inserted).toBe(true);
      expect(await client.getCollection(collection.collectionId)).toEqual(collection);
      const merge = await createAtlasSpecimenMerge({
        createdAt: "2026-08-24T17:05:00.000Z",
        aliasSpecimenId: "http-a",
        canonicalSpecimenId: "http-b",
        rationale: "explicit merge only",
        supportingRecordIds: records.map((item) => item.atlasRecordId),
      });
      expect((await client.publishSpecimenMerge(merge)).inserted).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error !== undefined && error !== null ? reject(error) : resolve());
      });
    }
  });

  it("rejects PCM, digest mismatch, and malformed artifacts at the HTTP boundary", async () => {
    const { server, url } = await listenAtlasApi();
    try {
      const published = await record("http-pcm", "pcm");
      const pcm = await fetch(`${url}/v1/atlas/records`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...published, samples: new Array(32).fill(0.2) }),
      });
      expect(pcm.status).toBe(400);
      const pcmBody = await pcm.json() as { error: { code: string }; contentAddress: string; contractVersion: string };
      expect(pcmBody.error.code).toBe("pcm-rejected");
      expect(pcmBody.contentAddress).toMatch(/^sha256:/);
      expect(pcmBody.contractVersion).toBe("resonance-atlas-http-1");

      const mismatch = await fetch(`${url}/v1/atlas/records`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...published, atlasRecordId: await contentDigest({ tampered: true }) }),
      });
      expect(mismatch.status).toBe(400);
      expect((await mismatch.json() as { error: { code: string } }).error.code).toBe("digest-mismatch");

      const malformed = await fetch(`${url}/v1/atlas/records`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hello: "world" }),
      });
      expect(malformed.status).toBe(400);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error !== undefined && error !== null ? reject(error) : resolve());
      });
    }
  });

  it("accepts V2 observation publication without canonical object identity", async () => {
    const { server, url } = await listenAtlasApi();
    try {
      const observation = await createPublicObservationRecord({
        createdAt: "2026-08-24T18:00:00.000Z",
        measurementId: await contentDigest({ observation: 1 }),
        derivationIds: [],
        contributor: { contributorId: "http", displayName: null },
        stationId: "digital-atlas-station",
        stationStatus: "unknown",
      });
      expect(observation.canonicalObjectIdentity).toBeNull();
      expect("specimenId" in observation).toBe(false);
      const created = await fetch(`${url}/v2/atlas/observations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(observation),
      });
      expect(created.status).toBe(201);
      const fetched = await fetch(`${url}/v2/atlas/observations/${encodeURIComponent(observation.observationRecordId)}`);
      expect(fetched.status).toBe(200);
      const body = await fetched.json() as { contentAddress: string; body: { observationRecordId: string } };
      expect(body.contentAddress).toBe(observation.observationRecordId);
      expect(body.body.observationRecordId).toBe(observation.observationRecordId);

      const specimen = await createSpecimenRecord({
        createdAt: "2026-08-24T18:01:00.000Z",
        specimenId: "kitchen-bowl-group",
        grounding: "user-grouped",
        displayLabel: "Kitchen bowl group",
        objectFamily: "bowl",
        material: "other",
        publicDescription: null,
        identitySource: "user-group",
      });
      const assertion = await createSpecimenMembershipAssertion({
        createdAt: "2026-08-24T18:02:00.000Z",
        observationRecordId: observation.observationRecordId,
        specimenRecordId: specimen.specimenRecordId,
        basis: "contributor-declaration",
        assurance: "self-declared",
        doesNotEstablish: ["collection membership is not same-object identity", "this assertion is not a physical-object proof"],
      });
      expect((await fetch(`${url}/v2/atlas/specimens`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(specimen) })).status).toBe(201);
      expect((await fetch(`${url}/v2/atlas/membership-assertions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(assertion) })).status).toBe(201);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error !== undefined && error !== null ? reject(error) : resolve());
      });
    }
  });

  it("stores challenges that refuse identity inference as contest truth", async () => {
    const { server, url } = await listenAtlasApi();
    try {
      const client = createHttpAtlasClient(url);
      const challenge = await createChallengeDefinition({
        challengeVersion: "city-rings-1",
        prompt: "Share one consented observation from your city.",
        startsAt: "2026-09-01T00:00:00.000Z",
        endsAt: "2026-09-08T00:00:00.000Z",
        allowedArtifactTypes: ["public-observation"],
        consentRules: {
          publicationRequired: true,
          rawAudioAllowed: false,
          canonicalObjectIdentityRequired: false,
          locationConsentRequiredForGeographicAggregation: true,
        },
        rankingCriteria: "count of consented observations; no identity or material inference",
        resultStatement: {
          intent: "both",
          statement: "Playful city gallery with an optional scientific appendix. Rankings are not physical identity and not material claims.",
        },
        physicalProtocol: null,
      });
      expect((await client.publishChallenge(challenge)).inserted).toBe(true);
      expect(await client.getChallenge(challenge.challengeId)).toEqual(challenge);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error !== undefined && error !== null ? reject(error) : resolve());
      });
    }
  });
});
