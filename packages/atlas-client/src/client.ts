import type {
  AtlasCollectionV1,
  AtlasSearchQueryV1,
  AtlasSearchResultV1,
  AtlasSpecimenMergeV1,
  ResonanceAtlasRecordV1,
  ResonanceAtlasServiceV1,
  ResonanceAtlasSnapshotV1,
} from "@everything-rings/validation";
import {
  applyAtlasSpecimenMerge,
  emptyAtlasRegistry,
  publishAtlasRecord,
  searchAtlas,
  snapshotAtlasRegistry,
  verifyAtlasCollection,
  verifyAtlasRecord,
  verifyAtlasSpecimenMerge,
  type AtlasRegistryStateV1,
} from "@everything-rings/validation";
import { ATLAS_SERVICE_CONTRACT_VERSION, isAtlasHttpError, type AtlasHttpSuccessV1 } from "./envelope";
import { verifyChallengeDefinition, type ChallengeDefinitionV1 } from "./participation";

export interface AtlasPublishResultV1 {
  readonly inserted: boolean;
  readonly atlasRecordId: string;
}

export interface AtlasCollectionPublishResultV1 {
  readonly inserted: boolean;
  readonly collectionId: string;
}

export interface AtlasMergePublishResultV1 {
  readonly inserted: boolean;
  readonly mergeId: string;
}

export interface ResonanceAtlasClientV1 extends ResonanceAtlasServiceV1 {
  publishCollection(collection: AtlasCollectionV1): Promise<AtlasCollectionPublishResultV1>;
  getCollection(collectionId: string): Promise<AtlasCollectionV1 | null>;
  listCollections(): Promise<readonly AtlasCollectionV1[]>;
  publishSpecimenMerge(merge: AtlasSpecimenMergeV1): Promise<AtlasMergePublishResultV1>;
  getSpecimenMerge(mergeId: string): Promise<AtlasSpecimenMergeV1 | null>;
  publishChallenge(challenge: ChallengeDefinitionV1): Promise<{ readonly inserted: boolean; readonly challengeId: string }>;
  getChallenge(challengeId: string): Promise<ChallengeDefinitionV1 | null>;
}

export class MemoryResonanceAtlasClientV1 implements ResonanceAtlasClientV1 {
  readonly serviceContractVersion = ATLAS_SERVICE_CONTRACT_VERSION;
  private registry: AtlasRegistryStateV1 = emptyAtlasRegistry();
  private readonly collections = new Map<string, AtlasCollectionV1>();
  private readonly snapshots = new Map<string, ResonanceAtlasSnapshotV1>();
  private readonly challenges = new Map<string, ChallengeDefinitionV1>();

  async publish(record: ResonanceAtlasRecordV1): Promise<AtlasPublishResultV1> {
    if (!await verifyAtlasRecord(record)) throw new Error("Atlas record failed content verification");
    const before = this.registry.records.length;
    this.registry = await publishAtlasRecord(this.registry, record);
    return { inserted: this.registry.records.length > before, atlasRecordId: record.atlasRecordId };
  }

  async get(atlasRecordId: string): Promise<ResonanceAtlasRecordV1 | null> {
    return this.registry.records.find((record) => record.atlasRecordId === atlasRecordId) ?? null;
  }

  async search(query: AtlasSearchQueryV1): Promise<readonly AtlasSearchResultV1[]> {
    return searchAtlas(this.registry, query);
  }

  async snapshot(createdAt: string): Promise<ResonanceAtlasSnapshotV1> {
    const snapshot = await snapshotAtlasRegistry(this.registry, createdAt);
    this.snapshots.set(snapshot.snapshotId, snapshot);
    return snapshot;
  }

  async count(): Promise<number> {
    return this.registry.records.length;
  }

  async publishCollection(collection: AtlasCollectionV1): Promise<AtlasCollectionPublishResultV1> {
    if (!await verifyAtlasCollection(collection)) throw new Error("Atlas collection failed content verification");
    const existed = this.collections.has(collection.collectionId);
    if (!existed) this.collections.set(collection.collectionId, collection);
    return { inserted: !existed, collectionId: collection.collectionId };
  }

  async getCollection(collectionId: string): Promise<AtlasCollectionV1 | null> {
    return this.collections.get(collectionId) ?? null;
  }

  async listCollections(): Promise<readonly AtlasCollectionV1[]> {
    return [...this.collections.values()].sort((left, right) => left.collectionId.localeCompare(right.collectionId));
  }

  async publishSpecimenMerge(merge: AtlasSpecimenMergeV1): Promise<AtlasMergePublishResultV1> {
    if (!await verifyAtlasSpecimenMerge(merge)) throw new Error("Atlas specimen merge failed content verification");
    const existed = this.registry.specimenMerges.some((candidate) => candidate.mergeId === merge.mergeId);
    this.registry = await applyAtlasSpecimenMerge(this.registry, merge);
    return { inserted: !existed, mergeId: merge.mergeId };
  }

  async getSpecimenMerge(mergeId: string): Promise<AtlasSpecimenMergeV1 | null> {
    return this.registry.specimenMerges.find((merge) => merge.mergeId === mergeId) ?? null;
  }

  async publishChallenge(challenge: ChallengeDefinitionV1): Promise<{ readonly inserted: boolean; readonly challengeId: string }> {
    if (!await verifyChallengeDefinition(challenge)) throw new Error("Atlas challenge failed content verification");
    const existed = this.challenges.has(challenge.challengeId);
    if (!existed) this.challenges.set(challenge.challengeId, challenge);
    return { inserted: !existed, challengeId: challenge.challengeId };
  }

  async getChallenge(challengeId: string): Promise<ChallengeDefinitionV1 | null> {
    return this.challenges.get(challengeId) ?? null;
  }
}

export function createMemoryAtlasClient(): ResonanceAtlasClientV1 {
  return new MemoryResonanceAtlasClientV1();
}

export class HttpResonanceAtlasClientV1 implements ResonanceAtlasClientV1 {
  readonly serviceContractVersion = ATLAS_SERVICE_CONTRACT_VERSION;

  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async publish(record: ResonanceAtlasRecordV1): Promise<AtlasPublishResultV1> {
    const body = await this.request<AtlasPublishResultV1>("POST", "/v1/atlas/records", record);
    return { inserted: body.inserted, atlasRecordId: body.atlasRecordId };
  }

  async get(atlasRecordId: string): Promise<ResonanceAtlasRecordV1 | null> {
    return this.requestNullable<ResonanceAtlasRecordV1>("GET", `/v1/atlas/records/${encodeURIComponent(atlasRecordId)}`);
  }

  async search(query: AtlasSearchQueryV1): Promise<readonly AtlasSearchResultV1[]> {
    const params = new URLSearchParams();
    if (query.text !== undefined) params.set("text", query.text);
    if (query.material !== undefined) params.set("material", query.material);
    if (query.objectFamily !== undefined) params.set("objectFamily", query.objectFamily);
    if (query.contributorId !== undefined) params.set("contributorId", query.contributorId);
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    const body = await this.request<{ readonly results: readonly AtlasSearchResultV1[] }>("GET", `/v1/atlas/search${suffix}`);
    return body.results;
  }

  async snapshot(createdAt: string): Promise<ResonanceAtlasSnapshotV1> {
    return this.request<ResonanceAtlasSnapshotV1>("POST", "/v1/atlas/snapshots", { createdAt });
  }

  async count(): Promise<number> {
    const body = await this.request<{ readonly count: number }>("GET", "/v1/atlas/records");
    return body.count;
  }

  async publishCollection(collection: AtlasCollectionV1): Promise<AtlasCollectionPublishResultV1> {
    return this.request<AtlasCollectionPublishResultV1>("POST", "/v1/atlas/collections", collection);
  }

  async getCollection(collectionId: string): Promise<AtlasCollectionV1 | null> {
    return this.requestNullable<AtlasCollectionV1>("GET", `/v1/atlas/collections/${encodeURIComponent(collectionId)}`);
  }

  async listCollections(): Promise<readonly AtlasCollectionV1[]> {
    const body = await this.request<{ readonly collections: readonly AtlasCollectionV1[] }>("GET", "/v1/atlas/collections");
    return body.collections;
  }

  async publishSpecimenMerge(merge: AtlasSpecimenMergeV1): Promise<AtlasMergePublishResultV1> {
    return this.request<AtlasMergePublishResultV1>("POST", "/v1/atlas/specimen-merges", merge);
  }

  async getSpecimenMerge(mergeId: string): Promise<AtlasSpecimenMergeV1 | null> {
    return this.requestNullable<AtlasSpecimenMergeV1>("GET", `/v1/atlas/specimen-merges/${encodeURIComponent(mergeId)}`);
  }

  async publishChallenge(challenge: ChallengeDefinitionV1): Promise<{ readonly inserted: boolean; readonly challengeId: string }> {
    return this.request("POST", "/v1/atlas/challenges", challenge);
  }

  async getChallenge(challengeId: string): Promise<ChallengeDefinitionV1 | null> {
    return this.requestNullable<ChallengeDefinitionV1>("GET", `/v1/atlas/challenges/${encodeURIComponent(challengeId)}`);
  }

  private async request<T>(method: string, path: string, payload?: unknown): Promise<T> {
    const response = payload === undefined ? await this.send(method, path) : await this.send(method, path, payload);
    if (response.status === 404) throw new Error(`Atlas resource not found: ${path}`);
    const json: unknown = await response.json();
    if (!response.ok || isAtlasHttpError(json)) {
      const message = isAtlasHttpError(json) ? json.error.message : `Atlas HTTP ${response.status}`;
      throw new Error(message);
    }
    return (json as AtlasHttpSuccessV1<T>).body;
  }

  private async requestNullable<T>(method: string, path: string): Promise<T | null> {
    const response = await this.send(method, path);
    if (response.status === 404) return null;
    const json: unknown = await response.json();
    if (!response.ok || isAtlasHttpError(json)) {
      const message = isAtlasHttpError(json) ? json.error.message : `Atlas HTTP ${response.status}`;
      throw new Error(message);
    }
    return (json as AtlasHttpSuccessV1<T>).body;
  }

  private send(method: string, path: string): Promise<Response>;
  private send(method: string, path: string, payload: unknown): Promise<Response>;
  private send(method: string, path: string, payload?: unknown): Promise<Response> {
    const headers: Record<string, string> = { accept: "application/json" };
    const init: RequestInit = { method, headers };
    if (payload !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(payload);
    }
    return this.fetchImpl(`${this.baseUrl.replace(/\/$/, "")}${path}`, init);
  }
}

export function createHttpAtlasClient(baseUrl: string, fetchImpl: typeof fetch = fetch): ResonanceAtlasClientV1 {
  return new HttpResonanceAtlasClientV1(baseUrl, fetchImpl);
}
