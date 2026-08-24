import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import {
  buildAcousticObjectModel,
  compareFingerprintToObjectModel,
  type AcousticObjectModelV1,
  type AcousticObjectObservationV1,
} from "./object-model";

export interface SonicTwinIndexEntryV1 {
  readonly specimenId: string;
  readonly model: AcousticObjectModelV1;
}

export interface SonicTwinIndexV1 {
  readonly schemaVersion: 1;
  readonly indexVersion: "sonic-twin-index-1";
  readonly entries: readonly SonicTwinIndexEntryV1[];
}

export function buildSonicTwinIndex(
  observations: readonly AcousticObjectObservationV1[],
): SonicTwinIndexV1 {
  const grouped = new Map<string, AcousticObjectObservationV1[]>();
  for (const observation of observations) {
    const normalized = observation.specimenId.trim().toLocaleLowerCase("en-US");
    if (normalized.length === 0) throw new Error("Sonic Twin index observations require specimenId");
    const current = grouped.get(normalized) ?? [];
    current.push(observation);
    grouped.set(normalized, current);
  }
  const entries = [...grouped.values()]
    .map((group) => ({ specimenId: group[0]!.specimenId.trim(), model: buildAcousticObjectModel(group) }))
    .sort((left, right) => left.specimenId.localeCompare(right.specimenId));
  return { schemaVersion: 1, indexVersion: "sonic-twin-index-1", entries };
}

export interface SonicTwinRetrievalResultV1 {
  readonly rank: number;
  readonly specimenId: string;
  readonly evidenceScore: number;
  readonly normalizedDistance: number;
  readonly matchedModelModes: number;
  readonly modelModeCount: number;
}

export function retrieveSonicTwin(
  query: AcousticFingerprintV1,
  index: SonicTwinIndexV1,
  limit = index.entries.length,
): readonly SonicTwinRetrievalResultV1[] {
  if (!Number.isInteger(limit) || limit <= 0) throw new Error("retrieval limit must be a positive integer");
  return index.entries
    .map((entry) => {
      const comparison = compareFingerprintToObjectModel(query, entry.model);
      return {
        specimenId: entry.specimenId,
        evidenceScore: comparison.evidenceScore,
        normalizedDistance: comparison.normalizedDistance,
        matchedModelModes: comparison.matchedModelModes,
        modelModeCount: comparison.modelModeCount,
      };
    })
    .sort((left, right) => right.evidenceScore - left.evidenceScore || left.specimenId.localeCompare(right.specimenId))
    .slice(0, Math.min(limit, index.entries.length))
    .map((result, indexValue) => ({ rank: indexValue + 1, ...result }));
}

export interface SonicTwinRetrievalQueryV1 {
  readonly queryId: string;
  readonly trueSpecimenId: string;
  readonly fingerprint: AcousticFingerprintV1;
}

export interface SonicTwinRetrievalMetricsV1 {
  readonly queryCount: number;
  readonly eligibleQueryCount: number;
  readonly recallAt1: number | null;
  readonly recallAt3: number | null;
  readonly recallAt5: number | null;
  readonly meanReciprocalRank: number | null;
  readonly meanTrueSpecimenRank: number | null;
  readonly missingTrueSpecimenCount: number;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function benchmarkSonicTwinRetrieval(
  queries: readonly SonicTwinRetrievalQueryV1[],
  index: SonicTwinIndexV1,
): SonicTwinRetrievalMetricsV1 {
  const indexedSpecimens = new Set(index.entries.map((entry) => entry.specimenId.trim().toLocaleLowerCase("en-US")));
  let eligible = 0;
  let hit1 = 0;
  let hit3 = 0;
  let hit5 = 0;
  let reciprocalRankSum = 0;
  let rankSum = 0;
  let missing = 0;

  for (const query of queries) {
    const target = query.trueSpecimenId.trim().toLocaleLowerCase("en-US");
    if (!indexedSpecimens.has(target)) {
      missing += 1;
      continue;
    }
    eligible += 1;
    const ranked = retrieveSonicTwin(query.fingerprint, index);
    const rank = ranked.findIndex((result) => result.specimenId.trim().toLocaleLowerCase("en-US") === target) + 1;
    if (rank <= 0) throw new Error("indexed true specimen disappeared from retrieval ranking");
    if (rank <= 1) hit1 += 1;
    if (rank <= 3) hit3 += 1;
    if (rank <= 5) hit5 += 1;
    reciprocalRankSum += 1 / rank;
    rankSum += rank;
  }

  return {
    queryCount: queries.length,
    eligibleQueryCount: eligible,
    recallAt1: rate(hit1, eligible),
    recallAt3: rate(hit3, eligible),
    recallAt5: rate(hit5, eligible),
    meanReciprocalRank: eligible === 0 ? null : reciprocalRankSum / eligible,
    meanTrueSpecimenRank: eligible === 0 ? null : rankSum / eligible,
    missingTrueSpecimenCount: missing,
  };
}
