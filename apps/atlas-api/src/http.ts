import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { contentDigest } from "@everything-rings/validation";
import {
  ATLAS_HTTP_CONTRACT_VERSION,
  ATLAS_RUNTIME_STAGE,
  ATLAS_SERVICE_CONTRACT_VERSION,
  type AtlasHttpErrorV1,
  type AtlasHttpSuccessV1,
} from "@everything-rings/atlas-client";
import { artifactContainsPcm } from "./pcm";
import { AtlasApiError, PersistentResonanceAtlasServiceV1, type DurableAtlasServiceV1 } from "./service";
import { createByteStore } from "./store";

export const ATLAS_FEATURE_FLAG = "atlas-alpha-synthetic" as const;
export const MAX_ATLAS_BODY_BYTES = 256 * 1024;

export interface AtlasApiServerOptions {
  readonly host?: string;
  readonly port?: number;
  readonly dataDir?: string | null;
  readonly service?: DurableAtlasServiceV1;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  const encoded = Buffer.from(JSON.stringify(body), "utf8");
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-atlas-stage": ATLAS_RUNTIME_STAGE,
    "x-atlas-public-network": "false",
  });
  response.end(encoded);
}

async function success<T>(contractVersion: string, contentAddress: string, body: T): Promise<AtlasHttpSuccessV1<T>> {
  return {
    contractVersion,
    httpContractVersion: ATLAS_HTTP_CONTRACT_VERSION,
    contentAddress,
    stage: ATLAS_RUNTIME_STAGE,
    publicNetwork: false,
    body,
  };
}

async function failure(status: number, code: string, message: string): Promise<AtlasHttpErrorV1> {
  return {
    contractVersion: ATLAS_HTTP_CONTRACT_VERSION,
    httpContractVersion: ATLAS_HTTP_CONTRACT_VERSION,
    contentAddress: await contentDigest({ status, code, message }),
    stage: ATLAS_RUNTIME_STAGE,
    publicNetwork: false,
    error: { status, code, message },
  };
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_ATLAS_BODY_BYTES) throw new AtlasApiError("request body exceeds PCM-free size limit", 413, "payload-too-large");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AtlasApiError("malformed JSON artifact", 400, "malformed-artifact");
  }
}

function restAfter(pathname: string, prefix: string): string | null {
  if (pathname === prefix) return "";
  if (!pathname.startsWith(`${prefix}/`)) return null;
  return decodeURIComponent(pathname.slice(prefix.length + 1));
}

export function createAtlasApiService(dataDir: string | null = null): PersistentResonanceAtlasServiceV1 {
  return new PersistentResonanceAtlasServiceV1(createByteStore(dataDir));
}

export function createAtlasApiServer(options: AtlasApiServerOptions = {}): Server {
  const service = options.service ?? createAtlasApiService(options.dataDir ?? null);
  return createServer((request, response) => {
    void handle(request, response, service);
  });
}

export async function listenAtlasApi(options: AtlasApiServerOptions = {}): Promise<{ readonly server: Server; readonly url: string }> {
  if (process.env.ATLAS_PUBLIC_HOSTING === "1") {
    throw new Error("Atlas API is alpha/synthetic and must not be started with ATLAS_PUBLIC_HOSTING=1");
  }
  const server = createAtlasApiServer(options);
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  await new Promise<void>((resolve) => {
    server.listen(port, host, () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Atlas API failed to bind a TCP port");
  return { server, url: `http://${host}:${address.port}` };
}

async function handle(request: IncomingMessage, response: ServerResponse, service: DurableAtlasServiceV1): Promise<void> {
  try {
    const url = new URL(request.url ?? "/", "http://atlas.local");
    const pathname = url.pathname.replace(/\/$/u, "") || "/";
    const method = request.method ?? "GET";

    if (method === "GET" && pathname === "/v1/atlas/health") {
      json(response, 200, await success(ATLAS_SERVICE_CONTRACT_VERSION, await contentDigest({
        featureFlag: ATLAS_FEATURE_FLAG,
        stage: ATLAS_RUNTIME_STAGE,
      }), {
        featureFlag: ATLAS_FEATURE_FLAG,
        stage: ATLAS_RUNTIME_STAGE,
        publicNetwork: false as const,
        serviceContractVersion: ATLAS_SERVICE_CONTRACT_VERSION,
      }));
      return;
    }

    if (method === "POST" && pathname === "/v1/atlas/records") {
      const payload = await readBody(request);
      if (artifactContainsPcm(payload)) throw new AtlasApiError("PCM-free Atlas artifacts must not include microphone samples", 400, "pcm-rejected");
      const result = await service.publish(payload as Parameters<DurableAtlasServiceV1["publish"]>[0]);
      json(response, result.inserted ? 201 : 200, await success("resonance-atlas-record-1", result.atlasRecordId, result));
      return;
    }

    if (method === "GET" && pathname === "/v1/atlas/records") {
      const requested = url.searchParams.get("atlasRecordId");
      if (requested !== null) {
        const record = await service.get(requested);
        if (record === null) {
          json(response, 404, await failure(404, "not-found", "Atlas record not found"));
          return;
        }
        json(response, 200, await success("resonance-atlas-record-1", record.atlasRecordId, record));
        return;
      }
      const count = await service.count();
      json(response, 200, await success(ATLAS_SERVICE_CONTRACT_VERSION, await contentDigest({ count }), { count }));
      return;
    }

    const recordId = restAfter(pathname, "/v1/atlas/records");
    if (method === "GET" && recordId !== null && recordId.length > 0) {
      const record = await service.get(recordId);
      if (record === null) {
        json(response, 404, await failure(404, "not-found", "Atlas record not found"));
        return;
      }
      json(response, 200, await success("resonance-atlas-record-1", record.atlasRecordId, record));
      return;
    }

    if (method === "GET" && pathname === "/v1/atlas/search") {
      const text = url.searchParams.get("text");
      const material = url.searchParams.get("material");
      const objectFamily = url.searchParams.get("objectFamily");
      const contributorId = url.searchParams.get("contributorId");
      const query = {
        ...(text !== null ? { text } : {}),
        ...(material !== null ? { material } : {}),
        ...(objectFamily !== null ? { objectFamily } : {}),
        ...(contributorId !== null ? { contributorId } : {}),
      };
      const results = await service.search(query);
      json(response, 200, await success(ATLAS_SERVICE_CONTRACT_VERSION, await contentDigest(results), { results }));
      return;
    }

    if (method === "POST" && pathname === "/v1/atlas/snapshots") {
      const payload = asObject(await readBody(request));
      const createdAt = typeof payload.createdAt === "string" ? payload.createdAt : "";
      const snapshot = await service.snapshot(createdAt);
      json(response, 201, await success("resonance-atlas-snapshot-1", snapshot.snapshotId, snapshot));
      return;
    }

    const snapshotId = restAfter(pathname, "/v1/atlas/snapshots");
    if (method === "GET" && snapshotId !== null && snapshotId.length > 0) {
      const snapshot = await service.getSnapshot(snapshotId);
      if (snapshot === null) {
        json(response, 404, await failure(404, "not-found", "Atlas snapshot not found"));
        return;
      }
      json(response, 200, await success("resonance-atlas-snapshot-1", snapshot.snapshotId, snapshot));
      return;
    }

    if (method === "POST" && pathname === "/v1/atlas/collections") {
      const payload = await readBody(request);
      if (artifactContainsPcm(payload)) throw new AtlasApiError("PCM-free Atlas artifacts must not include microphone samples", 400, "pcm-rejected");
      const result = await service.publishCollection(payload as Parameters<DurableAtlasServiceV1["publishCollection"]>[0]);
      json(response, result.inserted ? 201 : 200, await success("atlas-collection-1", result.collectionId, result));
      return;
    }

    if (method === "GET" && pathname === "/v1/atlas/collections") {
      const collections = await service.listCollections();
      json(response, 200, await success("atlas-collection-1", await contentDigest(collections.map((collection) => collection.collectionId)), { collections }));
      return;
    }

    const collectionId = restAfter(pathname, "/v1/atlas/collections");
    if (method === "GET" && collectionId !== null && collectionId.length > 0) {
      const collection = await service.getCollection(collectionId);
      if (collection === null) {
        json(response, 404, await failure(404, "not-found", "Atlas collection not found"));
        return;
      }
      json(response, 200, await success("atlas-collection-1", collection.collectionId, collection));
      return;
    }

    if (method === "POST" && pathname === "/v1/atlas/specimen-merges") {
      const payload = await readBody(request);
      const result = await service.publishSpecimenMerge(payload as Parameters<DurableAtlasServiceV1["publishSpecimenMerge"]>[0]);
      json(response, result.inserted ? 201 : 200, await success("atlas-specimen-merge-1", result.mergeId, result));
      return;
    }

    const mergeId = restAfter(pathname, "/v1/atlas/specimen-merges");
    if (method === "GET" && mergeId !== null && mergeId.length > 0) {
      const merge = await service.getSpecimenMerge(mergeId);
      if (merge === null) {
        json(response, 404, await failure(404, "not-found", "Atlas specimen merge not found"));
        return;
      }
      json(response, 200, await success("atlas-specimen-merge-1", merge.mergeId, merge));
      return;
    }

    if (method === "POST" && pathname === "/v1/atlas/challenges") {
      const payload = await readBody(request);
      const result = await service.publishChallenge(payload as Parameters<DurableAtlasServiceV1["publishChallenge"]>[0]);
      json(response, result.inserted ? 201 : 200, await success("atlas-challenge-1", result.challengeId, result));
      return;
    }

    const challengeId = restAfter(pathname, "/v1/atlas/challenges");
    if (method === "GET" && challengeId !== null && challengeId.length > 0) {
      const challenge = await service.getChallenge(challengeId);
      if (challenge === null) {
        json(response, 404, await failure(404, "not-found", "Atlas challenge not found"));
        return;
      }
      json(response, 200, await success("atlas-challenge-1", challenge.challengeId, challenge));
      return;
    }

    if (method === "POST" && pathname === "/v2/atlas/observations") {
      const payload = await readBody(request);
      if (artifactContainsPcm(payload)) throw new AtlasApiError("PCM-free Atlas artifacts must not include microphone samples", 400, "pcm-rejected");
      const result = await service.publishObservation(payload as Parameters<DurableAtlasServiceV1["publishObservation"]>[0]);
      json(response, result.inserted ? 201 : 200, await success("public-observation-record-2", result.observationRecordId, result));
      return;
    }

    const observationId = restAfter(pathname, "/v2/atlas/observations");
    if (method === "GET" && observationId !== null && observationId.length > 0) {
      const observation = await service.getObservation(observationId);
      if (observation === null) {
        json(response, 404, await failure(404, "not-found", "V2 observation not found"));
        return;
      }
      json(response, 200, await success("public-observation-record-2", observation.observationRecordId, observation));
      return;
    }

    if (method === "POST" && pathname === "/v2/atlas/specimens") {
      const payload = await readBody(request);
      const result = await service.publishSpecimen(payload as Parameters<DurableAtlasServiceV1["publishSpecimen"]>[0]);
      json(response, result.inserted ? 201 : 200, await success("specimen-record-2", result.specimenRecordId, result));
      return;
    }

    if (method === "POST" && pathname === "/v2/atlas/membership-assertions") {
      const payload = await readBody(request);
      const result = await service.publishMembershipAssertion(payload as Parameters<DurableAtlasServiceV1["publishMembershipAssertion"]>[0]);
      json(response, result.inserted ? 201 : 200, await success("specimen-membership-assertion-2", result.assertionId, result));
      return;
    }

    json(response, 404, await failure(404, "not-found", "unknown Atlas route"));
  } catch (error) {
    const status = error instanceof AtlasApiError ? error.status : 400;
    const code = error instanceof AtlasApiError ? error.code : "malformed-artifact";
    const message = error instanceof Error ? error.message : "malformed Atlas artifact";
    json(response, status, await failure(status, code, message));
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new AtlasApiError("malformed Atlas artifact", 400, "malformed-artifact");
  }
  return value as Record<string, unknown>;
}
