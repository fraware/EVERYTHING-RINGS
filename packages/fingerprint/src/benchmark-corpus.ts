import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { selectHardNegativePairs, specimenDisjointSplit, type BenchmarkSplit, type NuisanceMetadataV1 } from "./nuisance";

export interface TwinBenchmarkObservationV1 {
  readonly observationId: string;
  readonly specimenId: string;
  readonly objectFamily: string;
  readonly source: "digital-twin" | "physical" | "external-dataset";
  readonly fingerprint: AcousticFingerprintV1;
  readonly nuisance: NuisanceMetadataV1;
}

export interface TwinBenchmarkCorpusV1 {
  readonly schemaVersion: 1;
  readonly corpusContractVersion: "sonic-twin-benchmark-corpus-1";
  readonly corpusId: string;
  readonly createdAt: string;
  readonly observations: readonly TwinBenchmarkObservationV1[];
}

export interface TwinBenchmarkCorpusValidationV1 {
  readonly valid: boolean;
  readonly observationCount: number;
  readonly specimenCount: number;
  readonly objectFamilyCount: number;
  readonly sourceCounts: Readonly<Record<TwinBenchmarkObservationV1["source"], number>>;
  readonly splitSpecimenCounts: Readonly<Record<BenchmarkSplit, number>>;
  readonly reasons: readonly string[];
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function validateTwinBenchmarkCorpus(corpus: TwinBenchmarkCorpusV1): TwinBenchmarkCorpusValidationV1 {
  const reasons: string[] = [];
  if (corpus.schemaVersion !== 1) reasons.push("schemaVersion must be 1");
  if (corpus.corpusContractVersion !== "sonic-twin-benchmark-corpus-1") reasons.push("corpus contract version mismatch");
  if (corpus.corpusId.trim().length === 0) reasons.push("corpusId is required");
  if (!Number.isFinite(Date.parse(corpus.createdAt))) reasons.push("createdAt is invalid");
  if (corpus.observations.length === 0) reasons.push("corpus must contain observations");

  const observationIds = new Set<string>();
  const specimenFamily = new Map<string, string>();
  const specimenSplit = new Map<string, BenchmarkSplit>();
  const sourceCounts: Record<TwinBenchmarkObservationV1["source"], number> = {
    "digital-twin": 0,
    physical: 0,
    "external-dataset": 0,
  };

  for (const observation of corpus.observations) {
    const observationId = observation.observationId.trim();
    const specimenId = normalized(observation.specimenId);
    const family = normalized(observation.objectFamily);
    if (observationId.length === 0) reasons.push("observationId is required");
    if (observationIds.has(observationId)) reasons.push(`duplicate observationId ${observationId}`);
    observationIds.add(observationId);
    if (specimenId.length === 0) reasons.push(`observation ${observationId} has empty specimenId`);
    if (family.length === 0) reasons.push(`observation ${observationId} has empty objectFamily`);
    const priorFamily = specimenFamily.get(specimenId);
    if (priorFamily !== undefined && priorFamily !== family) reasons.push(`specimen ${observation.specimenId} has conflicting objectFamily labels`);
    else specimenFamily.set(specimenId, family);
    const split = specimenDisjointSplit(specimenId);
    const priorSplit = specimenSplit.get(specimenId);
    if (priorSplit !== undefined && priorSplit !== split) reasons.push(`specimen ${observation.specimenId} leaks across benchmark splits`);
    specimenSplit.set(specimenId, split);
    sourceCounts[observation.source] += 1;
    if (observation.fingerprint.modes.length === 0) reasons.push(`observation ${observationId} has no fingerprint modes`);
  }

  const splitSpecimenCounts: Record<BenchmarkSplit, number> = { train: 0, validation: 0, test: 0 };
  for (const split of specimenSplit.values()) splitSpecimenCounts[split] += 1;
  return {
    valid: reasons.length === 0,
    observationCount: corpus.observations.length,
    specimenCount: specimenFamily.size,
    objectFamilyCount: new Set(specimenFamily.values()).size,
    sourceCounts,
    splitSpecimenCounts,
    reasons: [...new Set(reasons)],
  };
}

export interface TwinVerificationPairV1 {
  readonly pairId: string;
  readonly samePhysicalSpecimen: boolean;
  readonly leftObservationId: string;
  readonly rightObservationId: string;
  readonly leftSpecimenId: string;
  readonly rightSpecimenId: string;
  readonly split: BenchmarkSplit;
  readonly reference: AcousticFingerprintV1;
  readonly candidate: AcousticFingerprintV1;
  readonly pairKind: "same-specimen" | "hard-negative";
}

function pairId(left: TwinBenchmarkObservationV1, right: TwinBenchmarkObservationV1, kind: string): string {
  return `${kind}:${left.observationId}::${right.observationId}`;
}

export function buildTwinVerificationPairs(
  corpus: TwinBenchmarkCorpusV1,
  hardNegativeLimitPerSplit = 200,
): readonly TwinVerificationPairV1[] {
  const validation = validateTwinBenchmarkCorpus(corpus);
  if (!validation.valid) throw new Error(`invalid benchmark corpus: ${validation.reasons.join("; ")}`);
  if (!Number.isInteger(hardNegativeLimitPerSplit) || hardNegativeLimitPerSplit <= 0) {
    throw new Error("hardNegativeLimitPerSplit must be a positive integer");
  }
  const pairs: TwinVerificationPairV1[] = [];
  for (const split of ["train", "validation", "test"] as const) {
    const observations = corpus.observations.filter((observation) => specimenDisjointSplit(observation.specimenId) === split);
    const bySpecimen = new Map<string, TwinBenchmarkObservationV1[]>();
    for (const observation of observations) {
      const key = normalized(observation.specimenId);
      const group = bySpecimen.get(key) ?? [];
      group.push(observation);
      bySpecimen.set(key, group);
    }
    for (const group of bySpecimen.values()) {
      for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
          const left = group[leftIndex]!;
          const right = group[rightIndex]!;
          pairs.push({
            pairId: pairId(left, right, "same"),
            samePhysicalSpecimen: true,
            leftObservationId: left.observationId,
            rightObservationId: right.observationId,
            leftSpecimenId: left.specimenId,
            rightSpecimenId: right.specimenId,
            split,
            reference: left.fingerprint,
            candidate: right.fingerprint,
            pairKind: "same-specimen",
          });
        }
      }
    }

    const hard = selectHardNegativePairs(observations, Math.min(hardNegativeLimitPerSplit, Math.max(1, observations.length * observations.length)));
    const byObservation = new Map(observations.map((observation) => [observation.observationId, observation] as const));
    for (const negative of hard) {
      const left = byObservation.get(negative.leftObservationId);
      const right = byObservation.get(negative.rightObservationId);
      if (left === undefined || right === undefined) continue;
      pairs.push({
        pairId: pairId(left, right, "hard-negative"),
        samePhysicalSpecimen: false,
        leftObservationId: left.observationId,
        rightObservationId: right.observationId,
        leftSpecimenId: left.specimenId,
        rightSpecimenId: right.specimenId,
        split,
        reference: left.fingerprint,
        candidate: right.fingerprint,
        pairKind: "hard-negative",
      });
    }
  }
  return pairs.sort((left, right) => left.split.localeCompare(right.split) || left.pairId.localeCompare(right.pairId));
}
