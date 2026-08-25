import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { fingerprintRecurrence } from "./recurrence";

export interface NuisanceMetadataV1 {
  readonly strikeLocation: string;
  readonly striker: string;
  readonly support: string;
  readonly microphoneDistanceClass: string;
  readonly room: string;
  readonly stationId: string;
  readonly operatorId: string;
  readonly dayId: string;
}

export interface LabeledFingerprintObservationV1 {
  readonly observationId: string;
  readonly specimenId: string;
  readonly fingerprint: AcousticFingerprintV1;
  readonly nuisance: NuisanceMetadataV1;
}

export type NuisanceFactor = keyof NuisanceMetadataV1;

export interface WithinSpecimenPairMetricV1 {
  readonly leftObservationId: string;
  readonly rightObservationId: string;
  readonly specimenId: string;
  readonly differingFactors: readonly NuisanceFactor[];
  readonly matchedModes: number;
  readonly medianFrequencyDriftCents: number;
  readonly meanFrequencyDriftCents: number;
}

export interface NuisanceFactorSummaryV1 {
  readonly factor: NuisanceFactor;
  readonly comparisonCount: number;
  readonly medianFrequencyDriftCents: number | null;
  readonly p90FrequencyDriftCents: number | null;
}

export interface NuisanceCharacterizationV1 {
  readonly schemaVersion: 1;
  readonly characterizationVersion: "nuisance-characterization-1";
  readonly observationCount: number;
  readonly specimenCount: number;
  readonly withinSpecimenPairs: readonly WithinSpecimenPairMetricV1[];
  readonly factorSummaries: readonly NuisanceFactorSummaryV1[];
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle] ?? null;
  return ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2;
}

function percentile(values: readonly number[], quantile: number): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.min(ordered.length - 1, Math.max(0, Math.ceil(quantile * ordered.length) - 1));
  return ordered[index] ?? null;
}

const NUISANCE_FACTORS: readonly NuisanceFactor[] = [
  "strikeLocation",
  "striker",
  "support",
  "microphoneDistanceClass",
  "room",
  "stationId",
  "operatorId",
  "dayId",
];

function differingFactors(left: NuisanceMetadataV1, right: NuisanceMetadataV1): NuisanceFactor[] {
  return NUISANCE_FACTORS.filter((factor) => left[factor] !== right[factor]);
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function canonicalObservationOrder(
  left: LabeledFingerprintObservationV1,
  right: LabeledFingerprintObservationV1,
): number {
  return left.observationId.trim().localeCompare(right.observationId.trim(), "en-US")
    || normalized(left.specimenId).localeCompare(normalized(right.specimenId), "en-US");
}

function validateObservationIds(observations: readonly LabeledFingerprintObservationV1[]): void {
  const seen = new Set<string>();
  for (const observation of observations) {
    const id = observation.observationId.trim();
    if (id.length === 0) throw new Error("nuisance observations require observationId");
    if (seen.has(id)) throw new Error(`duplicate nuisance observationId ${id}`);
    seen.add(id);
  }
}

export function characterizeNuisance(
  observations: readonly LabeledFingerprintObservationV1[],
): NuisanceCharacterizationV1 {
  validateObservationIds(observations);
  const bySpecimen = new Map<string, LabeledFingerprintObservationV1[]>();
  for (const observation of observations) {
    const key = normalized(observation.specimenId);
    if (key.length === 0) throw new Error("nuisance observations require specimenId");
    const current = bySpecimen.get(key) ?? [];
    current.push(observation);
    bySpecimen.set(key, current);
  }

  const pairs: WithinSpecimenPairMetricV1[] = [];
  const specimenGroups = [...bySpecimen.entries()].sort(([left], [right]) => left.localeCompare(right, "en-US"));
  for (const [, unsortedObservations] of specimenGroups) {
    const specimenObservations = [...unsortedObservations].sort(canonicalObservationOrder);
    for (let leftIndex = 0; leftIndex < specimenObservations.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < specimenObservations.length; rightIndex += 1) {
        const left = specimenObservations[leftIndex]!;
        const right = specimenObservations[rightIndex]!;
        const recurrence = fingerprintRecurrence(left.fingerprint, right.fingerprint);
        pairs.push({
          leftObservationId: left.observationId.trim(),
          rightObservationId: right.observationId.trim(),
          specimenId: left.specimenId.trim(),
          differingFactors: differingFactors(left.nuisance, right.nuisance),
          matchedModes: recurrence.matchedCount,
          medianFrequencyDriftCents: recurrence.medianCents,
          meanFrequencyDriftCents: recurrence.meanCents,
        });
      }
    }
  }

  const factorSummaries = NUISANCE_FACTORS.map((factor) => {
    const values = pairs
      .filter((pair) => pair.differingFactors.length === 1 && pair.differingFactors[0] === factor)
      .map((pair) => pair.medianFrequencyDriftCents)
      .filter(Number.isFinite);
    return {
      factor,
      comparisonCount: values.length,
      medianFrequencyDriftCents: median(values),
      p90FrequencyDriftCents: percentile(values, 0.9),
    };
  });

  return {
    schemaVersion: 1,
    characterizationVersion: "nuisance-characterization-1",
    observationCount: observations.length,
    specimenCount: bySpecimen.size,
    withinSpecimenPairs: pairs,
    factorSummaries,
  };
}

export interface HardNegativePairV1 {
  readonly leftObservationId: string;
  readonly rightObservationId: string;
  readonly leftSpecimenId: string;
  readonly rightSpecimenId: string;
  readonly medianFrequencyDriftCents: number;
  readonly matchedModes: number;
}

export function selectHardNegativePairs(
  observations: readonly LabeledFingerprintObservationV1[],
  limit: number,
): readonly HardNegativePairV1[] {
  if (!Number.isInteger(limit) || limit <= 0) throw new Error("hard-negative limit must be a positive integer");
  validateObservationIds(observations);
  const orderedObservations = [...observations].sort(canonicalObservationOrder);
  const pairs: HardNegativePairV1[] = [];
  for (let leftIndex = 0; leftIndex < orderedObservations.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < orderedObservations.length; rightIndex += 1) {
      const left = orderedObservations[leftIndex]!;
      const right = orderedObservations[rightIndex]!;
      if (normalized(left.specimenId) === normalized(right.specimenId)) continue;
      const recurrence = fingerprintRecurrence(left.fingerprint, right.fingerprint);
      pairs.push({
        leftObservationId: left.observationId.trim(),
        rightObservationId: right.observationId.trim(),
        leftSpecimenId: left.specimenId.trim(),
        rightSpecimenId: right.specimenId.trim(),
        medianFrequencyDriftCents: recurrence.medianCents,
        matchedModes: recurrence.matchedCount,
      });
    }
  }
  return pairs
    .sort((left, right) => left.medianFrequencyDriftCents - right.medianFrequencyDriftCents
      || right.matchedModes - left.matchedModes
      || left.leftObservationId.localeCompare(right.leftObservationId, "en-US")
      || left.rightObservationId.localeCompare(right.rightObservationId, "en-US"))
    .slice(0, limit);
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export type BenchmarkSplit = "train" | "validation" | "test";

export function specimenDisjointSplit(specimenId: string): BenchmarkSplit {
  const bucket = fnv1a32(specimenId.trim().toLocaleLowerCase("en-US")) % 100;
  if (bucket < 70) return "train";
  if (bucket < 85) return "validation";
  return "test";
}
