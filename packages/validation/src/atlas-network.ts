import type { AtlasRegistryStateV1 } from "./atlas-registry";
import { contentDigest } from "./provenance";

export interface AtlasCollectionV1 {
  readonly schemaVersion: 1;
  readonly collectionContractVersion: "atlas-collection-1";
  readonly collectionId: string;
  readonly createdAt: string;
  readonly contributorId: string;
  readonly title: string;
  readonly description: string | null;
  readonly atlasRecordIds: readonly string[];
  readonly visibility: "public";
}

function assertDigest(value: string, field: string): void {
  if (!/^sha256:[0-9a-f]{64}$/.test(value)) throw new Error(`${field} must be a sha256 digest`);
}

export async function createAtlasCollection(
  input: Omit<AtlasCollectionV1, "schemaVersion" | "collectionContractVersion" | "collectionId" | "visibility">,
): Promise<AtlasCollectionV1> {
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("Atlas collection createdAt is invalid");
  if (input.contributorId.trim().length === 0) throw new Error("Atlas collection contributorId is required");
  if (input.title.trim().length === 0) throw new Error("Atlas collection title is required");
  if (input.atlasRecordIds.length === 0) throw new Error("Atlas collection requires at least one record");
  const atlasRecordIds = [...new Set(input.atlasRecordIds)].sort();
  atlasRecordIds.forEach((id) => assertDigest(id, "atlasRecordId"));
  const payload = {
    ...input,
    atlasRecordIds,
    schemaVersion: 1 as const,
    collectionContractVersion: "atlas-collection-1" as const,
    visibility: "public" as const,
  };
  return { ...payload, collectionId: await contentDigest(payload) };
}

export type AtlasGraphNodeKind = "record" | "specimen" | "contributor" | "collection";
export type AtlasGraphEdgeKind = "describes" | "published-by" | "member-of" | "merged-into";

export interface AtlasGraphNodeV1 {
  readonly id: string;
  readonly kind: AtlasGraphNodeKind;
  readonly label: string;
}

export interface AtlasGraphEdgeV1 {
  readonly from: string;
  readonly to: string;
  readonly kind: AtlasGraphEdgeKind;
}

export interface AtlasGraphSnapshotV1 {
  readonly schemaVersion: 1;
  readonly graphContractVersion: "atlas-graph-1";
  readonly nodes: readonly AtlasGraphNodeV1[];
  readonly edges: readonly AtlasGraphEdgeV1[];
}

export function buildAtlasGraph(
  registry: AtlasRegistryStateV1,
  collections: readonly AtlasCollectionV1[] = [],
): AtlasGraphSnapshotV1 {
  const nodes = new Map<string, AtlasGraphNodeV1>();
  const edges: AtlasGraphEdgeV1[] = [];
  const addNode = (node: AtlasGraphNodeV1) => { if (!nodes.has(node.id)) nodes.set(node.id, node); };

  for (const record of registry.records) {
    const recordNode = `record:${record.atlasRecordId}`;
    const specimenNode = `specimen:${record.specimen.specimenId.trim().toLocaleLowerCase("en-US")}`;
    addNode({ id: recordNode, kind: "record", label: record.specimen.label });
    addNode({ id: specimenNode, kind: "specimen", label: record.specimen.label });
    edges.push({ from: recordNode, to: specimenNode, kind: "describes" });
    if (record.contributor !== null) {
      const contributorNode = `contributor:${record.contributor.contributorId.trim().toLocaleLowerCase("en-US")}`;
      addNode({ id: contributorNode, kind: "contributor", label: record.contributor.displayName ?? record.contributor.contributorId });
      edges.push({ from: recordNode, to: contributorNode, kind: "published-by" });
    }
  }

  for (const collection of collections) {
    const collectionNode = `collection:${collection.collectionId}`;
    addNode({ id: collectionNode, kind: "collection", label: collection.title });
    const contributorNode = `contributor:${collection.contributorId.trim().toLocaleLowerCase("en-US")}`;
    addNode({ id: contributorNode, kind: "contributor", label: collection.contributorId });
    for (const recordId of collection.atlasRecordIds) {
      const recordNode = `record:${recordId}`;
      if (!nodes.has(recordNode)) throw new Error(`Atlas collection references unknown record ${recordId}`);
      edges.push({ from: recordNode, to: collectionNode, kind: "member-of" });
    }
  }

  for (const merge of registry.specimenMerges) {
    const alias = `specimen:${merge.aliasSpecimenId.trim().toLocaleLowerCase("en-US")}`;
    const canonical = `specimen:${merge.canonicalSpecimenId.trim().toLocaleLowerCase("en-US")}`;
    if (!nodes.has(alias) || !nodes.has(canonical)) throw new Error("Atlas merge graph refers to unknown specimen node");
    edges.push({ from: alias, to: canonical, kind: "merged-into" });
  }

  return {
    schemaVersion: 1,
    graphContractVersion: "atlas-graph-1",
    nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: edges.sort((left, right) => `${left.from}|${left.kind}|${left.to}`.localeCompare(`${right.from}|${right.kind}|${right.to}`)),
  };
}
