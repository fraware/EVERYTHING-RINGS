import {
  applyAtlasSpecimenMerge,
  emptyAtlasRegistry,
  publishAtlasRecord,
  searchAtlas,
  snapshotAtlasRegistry,
  verifyAtlasCollection,
  verifyAtlasRecord,
  verifyAtlasSpecimenMerge,
  type AtlasCollectionV1,
  type AtlasRegistryStateV1,
  type AtlasSearchQueryV1,
  type AtlasSearchResultV1,
  type AtlasSpecimenMergeV1,
  type ResonanceAtlasRecordV1,
  type ResonanceAtlasServiceV1,
  type ResonanceAtlasSnapshotV1,
} from "@everything-rings/validation";
import {
  verifyChallengeDefinition,
  type ChallengeDefinitionV1,
} from "@everything-rings/atlas-client";
import {
  verifyPublicObservationRecord,
  verifySpecimenMembershipAssertion,
  verifySpecimenRecord,
  type PublicObservationRecord,
  type SpecimenMembershipAssertion,
  type SpecimenRecord,
} from "@everything-rings/validation";
import { artifactContainsPcm } from "./pcm";
import { decodeJson, encodeJson, type ByteStore } from "./store";

export const ATLAS_SERVICE_CONTRACT_VERSION = "resonance-atlas-service-1" as const;

export class AtlasApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "AtlasApiError";
  }
}

export interface AtlasRecordOverlayV1 {
  readonly schemaVersion: 1;
  readonly overlayContractVersion: "atlas-record-overlay-1";
  readonly atlasRecordId: string;
  readonly visibility: "public" | "unlisted" | "private";
  readonly tombstoned: boolean;
  readonly moderationStatus: "none" | "reported" | "hidden";
  readonly updatedAt: string;
}

export interface DurableAtlasServiceV1 extends ResonanceAtlasServiceV1 {
  publishCollection(collection: AtlasCollectionV1): Promise<{ readonly inserted: boolean; readonly collectionId: string }>;
  getCollection(collectionId: string): Promise<AtlasCollectionV1 | null>;
  listCollections(): Promise<readonly AtlasCollectionV1[]>;
  publishSpecimenMerge(merge: AtlasSpecimenMergeV1): Promise<{ readonly inserted: boolean; readonly mergeId: string }>;
  getSpecimenMerge(mergeId: string): Promise<AtlasSpecimenMergeV1 | null>;
  getSnapshot(snapshotId: string): Promise<ResonanceAtlasSnapshotV1 | null>;
  publishChallenge(challenge: ChallengeDefinitionV1): Promise<{ readonly inserted: boolean; readonly challengeId: string }>;
  getChallenge(challengeId: string): Promise<ChallengeDefinitionV1 | null>;
  publishObservation(record: PublicObservationRecord): Promise<{ readonly inserted: boolean; readonly observationRecordId: string }>;
  getObservation(observationRecordId: string): Promise<PublicObservationRecord | null>;
  publishSpecimen(record: SpecimenRecord): Promise<{ readonly inserted: boolean; readonly specimenRecordId: string }>;
  publishMembershipAssertion(assertion: SpecimenMembershipAssertion): Promise<{ readonly inserted: boolean; readonly assertionId: string }>;
  overlayFor(atlasRecordId: string): Promise<AtlasRecordOverlayV1 | null>;
}

class Mutex {
  private chain: Promise<void> = Promise.resolve();

  run<T>(work: () => Promise<T>): Promise<T> {
    const run = this.chain.then(work, work);
    this.chain = run.then(() => undefined, () => undefined);
    return run;
  }
}

function defaultOverlay(atlasRecordId: string): AtlasRecordOverlayV1 {
  return {
    schemaVersion: 1,
    overlayContractVersion: "atlas-record-overlay-1",
    atlasRecordId,
    visibility: "public",
    tombstoned: false,
    moderationStatus: "none",
    updatedAt: "1970-01-01T00:00:00.000Z",
  };
}

function asRecord<T>(value: unknown, code: string): T {
  if (value === null || typeof value !== "object") throw new AtlasApiError("malformed Atlas artifact", 400, code);
  return value as T;
}

export class PersistentResonanceAtlasServiceV1 implements DurableAtlasServiceV1 {
  readonly serviceContractVersion = ATLAS_SERVICE_CONTRACT_VERSION;
  private registry: AtlasRegistryStateV1 = emptyAtlasRegistry();
  private readonly collections = new Map<string, AtlasCollectionV1>();
  private readonly snapshots = new Map<string, ResonanceAtlasSnapshotV1>();
  private readonly challenges = new Map<string, ChallengeDefinitionV1>();
  private readonly observations = new Map<string, PublicObservationRecord>();
  private readonly specimens = new Map<string, SpecimenRecord>();
  private readonly assertions = new Map<string, SpecimenMembershipAssertion>();
  private readonly overlays = new Map<string, AtlasRecordOverlayV1>();
  private readonly mutex = new Mutex();
  private loaded = false;

  constructor(private readonly store: ByteStore) {}

  async publish(record: ResonanceAtlasRecordV1): Promise<{ readonly inserted: boolean; readonly atlasRecordId: string }> {
    return this.mutex.run(async () => {
      await this.ensureLoaded();
      this.assertPcmFree(record);
      if (!await verifyAtlasRecord(record)) {
        throw new AtlasApiError("Atlas record digest mismatch or malformed artifact", 400, "digest-mismatch");
      }
      const before = this.registry.records.length;
      try {
        this.registry = await publishAtlasRecord(this.registry, record);
      } catch (error) {
        throw new AtlasApiError(error instanceof Error ? error.message : "malformed Atlas artifact", 400, "malformed-artifact");
      }
      const inserted = this.registry.records.length > before;
      await this.store.putImmutable("records", record.atlasRecordId, encodeJson(record));
      if (inserted && !this.overlays.has(record.atlasRecordId)) {
        const overlay = defaultOverlay(record.atlasRecordId);
        this.overlays.set(record.atlasRecordId, overlay);
        await this.store.putOverlay("records", record.atlasRecordId, encodeJson(overlay));
      }
      return { inserted, atlasRecordId: record.atlasRecordId };
    });
  }

  async get(atlasRecordId: string): Promise<ResonanceAtlasRecordV1 | null> {
    await this.ensureLoaded();
    const overlay = this.overlays.get(atlasRecordId);
    if (overlay?.tombstoned === true) return null;
    return this.registry.records.find((record) => record.atlasRecordId === atlasRecordId) ?? null;
  }

  async search(query: AtlasSearchQueryV1): Promise<readonly AtlasSearchResultV1[]> {
    await this.ensureLoaded();
    const visible: AtlasRegistryStateV1 = {
      ...this.registry,
      records: this.registry.records.filter((record) => {
        const overlay = this.overlays.get(record.atlasRecordId) ?? defaultOverlay(record.atlasRecordId);
        return overlay.visibility === "public" && !overlay.tombstoned && overlay.moderationStatus !== "hidden";
      }),
    };
    return searchAtlas(visible, query);
  }

  async snapshot(createdAt: string): Promise<ResonanceAtlasSnapshotV1> {
    return this.mutex.run(async () => {
      await this.ensureLoaded();
      let snapshot: ResonanceAtlasSnapshotV1;
      try {
        snapshot = await snapshotAtlasRegistry(this.registry, createdAt);
      } catch (error) {
        throw new AtlasApiError(error instanceof Error ? error.message : "cannot snapshot", 400, "malformed-artifact");
      }
      this.snapshots.set(snapshot.snapshotId, snapshot);
      await this.store.putImmutable("snapshots", snapshot.snapshotId, encodeJson(snapshot));
      return snapshot;
    });
  }

  async count(): Promise<number> {
    await this.ensureLoaded();
    return this.registry.records.filter((record) => this.overlays.get(record.atlasRecordId)?.tombstoned !== true).length;
  }

  async publishCollection(collection: AtlasCollectionV1): Promise<{ readonly inserted: boolean; readonly collectionId: string }> {
    return this.mutex.run(async () => {
      await this.ensureLoaded();
      this.assertPcmFree(collection);
      if (!await verifyAtlasCollection(collection)) {
        throw new AtlasApiError("Atlas collection digest mismatch or malformed artifact", 400, "digest-mismatch");
      }
      for (const recordId of collection.atlasRecordIds) {
        if (!this.registry.records.some((record) => record.atlasRecordId === recordId)) {
          throw new AtlasApiError(`collection references unknown record ${recordId}`, 400, "malformed-artifact");
        }
      }
      const existed = this.collections.has(collection.collectionId);
      if (!existed) this.collections.set(collection.collectionId, collection);
      await this.store.putImmutable("collections", collection.collectionId, encodeJson(collection));
      return { inserted: !existed, collectionId: collection.collectionId };
    });
  }

  async getCollection(collectionId: string): Promise<AtlasCollectionV1 | null> {
    await this.ensureLoaded();
    return this.collections.get(collectionId) ?? null;
  }

  async listCollections(): Promise<readonly AtlasCollectionV1[]> {
    await this.ensureLoaded();
    return [...this.collections.values()].sort((left, right) => left.collectionId.localeCompare(right.collectionId));
  }

  async publishSpecimenMerge(merge: AtlasSpecimenMergeV1): Promise<{ readonly inserted: boolean; readonly mergeId: string }> {
    return this.mutex.run(async () => {
      await this.ensureLoaded();
      this.assertPcmFree(merge);
      if (!await verifyAtlasSpecimenMerge(merge)) {
        throw new AtlasApiError("Atlas specimen merge digest mismatch or malformed artifact", 400, "digest-mismatch");
      }
      const existed = this.registry.specimenMerges.some((candidate) => candidate.mergeId === merge.mergeId);
      try {
        this.registry = await applyAtlasSpecimenMerge(this.registry, merge);
      } catch (error) {
        throw new AtlasApiError(error instanceof Error ? error.message : "malformed Atlas merge", 400, "malformed-artifact");
      }
      await this.store.putImmutable("merges", merge.mergeId, encodeJson(merge));
      return { inserted: !existed, mergeId: merge.mergeId };
    });
  }

  async getSpecimenMerge(mergeId: string): Promise<AtlasSpecimenMergeV1 | null> {
    await this.ensureLoaded();
    return this.registry.specimenMerges.find((merge) => merge.mergeId === mergeId) ?? null;
  }

  async getSnapshot(snapshotId: string): Promise<ResonanceAtlasSnapshotV1 | null> {
    await this.ensureLoaded();
    return this.snapshots.get(snapshotId) ?? null;
  }

  async publishChallenge(challenge: ChallengeDefinitionV1): Promise<{ readonly inserted: boolean; readonly challengeId: string }> {
    return this.mutex.run(async () => {
      await this.ensureLoaded();
      this.assertPcmFree(challenge);
      if (!await verifyChallengeDefinition(challenge)) {
        throw new AtlasApiError("Atlas challenge digest mismatch or malformed artifact", 400, "digest-mismatch");
      }
      const existed = this.challenges.has(challenge.challengeId);
      if (!existed) this.challenges.set(challenge.challengeId, challenge);
      await this.store.putImmutable("challenges", challenge.challengeId, encodeJson(challenge));
      return { inserted: !existed, challengeId: challenge.challengeId };
    });
  }

  async getChallenge(challengeId: string): Promise<ChallengeDefinitionV1 | null> {
    await this.ensureLoaded();
    return this.challenges.get(challengeId) ?? null;
  }

  async publishObservation(record: PublicObservationRecord): Promise<{ readonly inserted: boolean; readonly observationRecordId: string }> {
    return this.mutex.run(async () => {
      await this.ensureLoaded();
      this.assertPcmFree(record);
      if (!await verifyPublicObservationRecord(record)) {
        throw new AtlasApiError("V2 observation digest mismatch or malformed artifact", 400, "digest-mismatch");
      }
      const existed = this.observations.has(record.observationRecordId);
      if (!existed) this.observations.set(record.observationRecordId, record);
      await this.store.putImmutable("v2-observations", record.observationRecordId, encodeJson(record));
      return { inserted: !existed, observationRecordId: record.observationRecordId };
    });
  }

  async getObservation(observationRecordId: string): Promise<PublicObservationRecord | null> {
    await this.ensureLoaded();
    return this.observations.get(observationRecordId) ?? null;
  }

  async publishSpecimen(record: SpecimenRecord): Promise<{ readonly inserted: boolean; readonly specimenRecordId: string }> {
    return this.mutex.run(async () => {
      await this.ensureLoaded();
      this.assertPcmFree(record);
      if (!await verifySpecimenRecord(record)) {
        throw new AtlasApiError("V2 specimen record is malformed", 400, "malformed-artifact");
      }
      const existed = this.specimens.has(record.specimenRecordId);
      if (!existed) this.specimens.set(record.specimenRecordId, record);
      await this.store.putImmutable("v2-specimens", record.specimenRecordId, encodeJson(record));
      return { inserted: !existed, specimenRecordId: record.specimenRecordId };
    });
  }

  async publishMembershipAssertion(assertion: SpecimenMembershipAssertion): Promise<{ readonly inserted: boolean; readonly assertionId: string }> {
    return this.mutex.run(async () => {
      await this.ensureLoaded();
      this.assertPcmFree(assertion);
      if (!await verifySpecimenMembershipAssertion(assertion)) {
        throw new AtlasApiError("V2 membership assertion digest mismatch or malformed artifact", 400, "digest-mismatch");
      }
      const existed = this.assertions.has(assertion.assertionId);
      if (!existed) this.assertions.set(assertion.assertionId, assertion);
      await this.store.putImmutable("v2-assertions", assertion.assertionId, encodeJson(assertion));
      return { inserted: !existed, assertionId: assertion.assertionId };
    });
  }

  async overlayFor(atlasRecordId: string): Promise<AtlasRecordOverlayV1 | null> {
    await this.ensureLoaded();
    return this.overlays.get(atlasRecordId) ?? null;
  }

  private assertPcmFree(value: unknown): void {
    if (artifactContainsPcm(value)) {
      throw new AtlasApiError("PCM-free Atlas artifacts must not include microphone samples", 400, "pcm-rejected");
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    await this.reloadFromStore();
    this.loaded = true;
  }

  private async reloadFromStore(): Promise<void> {
    let registry = emptyAtlasRegistry();
    for (const address of await this.store.listImmutable("records")) {
      const bytes = await this.store.getImmutable("records", address);
      if (bytes === null) continue;
      const record = asRecord<ResonanceAtlasRecordV1>(decodeJson(bytes), "malformed-artifact");
      if (!await verifyAtlasRecord(record)) throw new Error(`stored Atlas record ${address} failed verification`);
      registry = await publishAtlasRecord(registry, record);
    }
    for (const address of await this.store.listImmutable("merges")) {
      const bytes = await this.store.getImmutable("merges", address);
      if (bytes === null) continue;
      const merge = asRecord<AtlasSpecimenMergeV1>(decodeJson(bytes), "malformed-artifact");
      registry = await applyAtlasSpecimenMerge(registry, merge);
    }
    this.registry = registry;

    this.collections.clear();
    for (const address of await this.store.listImmutable("collections")) {
      const bytes = await this.store.getImmutable("collections", address);
      if (bytes === null) continue;
      const collection = asRecord<AtlasCollectionV1>(decodeJson(bytes), "malformed-artifact");
      this.collections.set(collection.collectionId, collection);
    }

    this.snapshots.clear();
    for (const address of await this.store.listImmutable("snapshots")) {
      const bytes = await this.store.getImmutable("snapshots", address);
      if (bytes === null) continue;
      const snapshot = asRecord<ResonanceAtlasSnapshotV1>(decodeJson(bytes), "malformed-artifact");
      this.snapshots.set(snapshot.snapshotId, snapshot);
    }

    this.challenges.clear();
    for (const address of await this.store.listImmutable("challenges")) {
      const bytes = await this.store.getImmutable("challenges", address);
      if (bytes === null) continue;
      const challenge = asRecord<ChallengeDefinitionV1>(decodeJson(bytes), "malformed-artifact");
      this.challenges.set(challenge.challengeId, challenge);
    }

    this.observations.clear();
    for (const address of await this.store.listImmutable("v2-observations")) {
      const bytes = await this.store.getImmutable("v2-observations", address);
      if (bytes === null) continue;
      const observation = asRecord<PublicObservationRecord>(decodeJson(bytes), "malformed-artifact");
      this.observations.set(observation.observationRecordId, observation);
    }

    this.specimens.clear();
    for (const address of await this.store.listImmutable("v2-specimens")) {
      const bytes = await this.store.getImmutable("v2-specimens", address);
      if (bytes === null) continue;
      const specimen = asRecord<SpecimenRecord>(decodeJson(bytes), "malformed-artifact");
      this.specimens.set(specimen.specimenRecordId, specimen);
    }

    this.assertions.clear();
    for (const address of await this.store.listImmutable("v2-assertions")) {
      const bytes = await this.store.getImmutable("v2-assertions", address);
      if (bytes === null) continue;
      const assertion = asRecord<SpecimenMembershipAssertion>(decodeJson(bytes), "malformed-artifact");
      this.assertions.set(assertion.assertionId, assertion);
    }

    this.overlays.clear();
    for (const record of this.registry.records) {
      const bytes = await this.store.getOverlay("records", record.atlasRecordId);
      this.overlays.set(record.atlasRecordId, bytes === null ? defaultOverlay(record.atlasRecordId) : asRecord<AtlasRecordOverlayV1>(decodeJson(bytes), "malformed-artifact"));
    }
  }
}
