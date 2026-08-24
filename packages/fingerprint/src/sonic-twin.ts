import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { fingerprintRecurrence } from "./recurrence";

export interface SonicTwinBaselineConfig {
  readonly minimumMatchedModes: number;
  readonly maximumFrequencyMedianCentsForMatch: number;
  readonly minimumFrequencyMedianCentsForNonMatch: number;
  readonly maximumMedianDecayLogRatioForMatch: number;
  readonly maximumMedianAmplitudeDbForMatch: number;
}

export const DEFAULT_SONIC_TWIN_BASELINE_CONFIG: SonicTwinBaselineConfig = {
  minimumMatchedModes: 3,
  maximumFrequencyMedianCentsForMatch: 35,
  minimumFrequencyMedianCentsForNonMatch: 120,
  maximumMedianDecayLogRatioForMatch: 0.45,
  maximumMedianAmplitudeDbForMatch: 8,
};

export type SonicTwinDecision = "match" | "nonmatch" | "abstain";

export interface SonicTwinBaselineComparison {
  readonly baselineVersion: "sonic-twin-baseline-1";
  readonly decision: SonicTwinDecision;
  readonly matchedModes: number;
  readonly frequencyMedianCents: number;
  readonly frequencyMeanCents: number;
  readonly medianDecayLogRatio: number | null;
  readonly medianAmplitudeDbDifference: number | null;
  readonly reasons: readonly string[];
  readonly calibratedProbability: null;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle] ?? null;
  return ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2;
}

function safeDbRatio(left: number, right: number): number {
  const floor = 1e-6;
  return 20 * Math.abs(Math.log10(Math.max(left, floor) / Math.max(right, floor)));
}

export function compareSonicTwinBaseline(
  reference: AcousticFingerprintV1,
  candidate: AcousticFingerprintV1,
  config: SonicTwinBaselineConfig = DEFAULT_SONIC_TWIN_BASELINE_CONFIG,
): SonicTwinBaselineComparison {
  const recurrence = fingerprintRecurrence(reference, candidate);
  const paired = recurrence.matches.flatMap((match) => {
    if (match.candidateIndex === undefined) return [];
    const left = reference.modes[match.referenceIndex];
    const right = candidate.modes[match.candidateIndex];
    if (left === undefined || right === undefined) return [];
    return [{ left, right }];
  });
  const decay = median(paired.map(({ left, right }) => Math.abs(Math.log(Math.max(left.decaySeconds, 1e-6) / Math.max(right.decaySeconds, 1e-6)))));
  const amplitude = median(paired.map(({ left, right }) => safeDbRatio(left.relativeAmplitude, right.relativeAmplitude)));
  const reasons: string[] = [];

  if (recurrence.matchedCount < config.minimumMatchedModes) {
    reasons.push(`fewer than ${config.minimumMatchedModes} modes are comparable`);
    return {
      baselineVersion: "sonic-twin-baseline-1",
      decision: "abstain",
      matchedModes: recurrence.matchedCount,
      frequencyMedianCents: recurrence.medianCents,
      frequencyMeanCents: recurrence.meanCents,
      medianDecayLogRatio: decay,
      medianAmplitudeDbDifference: amplitude,
      reasons,
      calibratedProbability: null,
    };
  }

  const frequencyMatch = recurrence.medianCents <= config.maximumFrequencyMedianCentsForMatch;
  const decayMatch = decay !== null && decay <= config.maximumMedianDecayLogRatioForMatch;
  const amplitudeMatch = amplitude !== null && amplitude <= config.maximumMedianAmplitudeDbForMatch;
  if (frequencyMatch && decayMatch && amplitudeMatch) {
    return {
      baselineVersion: "sonic-twin-baseline-1",
      decision: "match",
      matchedModes: recurrence.matchedCount,
      frequencyMedianCents: recurrence.medianCents,
      frequencyMeanCents: recurrence.meanCents,
      medianDecayLogRatio: decay,
      medianAmplitudeDbDifference: amplitude,
      reasons: [],
      calibratedProbability: null,
    };
  }

  if (recurrence.medianCents >= config.minimumFrequencyMedianCentsForNonMatch) {
    reasons.push("modal-frequency separation exceeds the nonmatch threshold");
    return {
      baselineVersion: "sonic-twin-baseline-1",
      decision: "nonmatch",
      matchedModes: recurrence.matchedCount,
      frequencyMedianCents: recurrence.medianCents,
      frequencyMeanCents: recurrence.meanCents,
      medianDecayLogRatio: decay,
      medianAmplitudeDbDifference: amplitude,
      reasons,
      calibratedProbability: null,
    };
  }

  if (!frequencyMatch) reasons.push("frequency agreement is outside the match region");
  if (!decayMatch) reasons.push("decay agreement is outside the match region");
  if (!amplitudeMatch) reasons.push("modal-amplitude agreement is outside the match region");
  return {
    baselineVersion: "sonic-twin-baseline-1",
    decision: "abstain",
    matchedModes: recurrence.matchedCount,
    frequencyMedianCents: recurrence.medianCents,
    frequencyMeanCents: recurrence.meanCents,
    medianDecayLogRatio: decay,
    medianAmplitudeDbDifference: amplitude,
    reasons,
    calibratedProbability: null,
  };
}

export interface LabeledTwinPair {
  readonly samePhysicalSpecimen: boolean;
  readonly reference: AcousticFingerprintV1;
  readonly candidate: AcousticFingerprintV1;
}

export interface SonicTwinBenchmarkMetrics {
  readonly pairCount: number;
  readonly coveredPairCount: number;
  readonly abstainedPairCount: number;
  readonly coverage: number;
  readonly truePositiveRate: number | null;
  readonly falsePositiveRate: number | null;
  readonly trueNegativeRate: number | null;
  readonly falseNegativeRate: number | null;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function benchmarkSonicTwinBaseline(
  pairs: readonly LabeledTwinPair[],
  config: SonicTwinBaselineConfig = DEFAULT_SONIC_TWIN_BASELINE_CONFIG,
): SonicTwinBenchmarkMetrics {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  let positives = 0;
  let negatives = 0;
  let covered = 0;

  for (const pair of pairs) {
    const result = compareSonicTwinBaseline(pair.reference, pair.candidate, config);
    if (result.decision === "abstain") continue;
    covered += 1;
    if (pair.samePhysicalSpecimen) {
      positives += 1;
      if (result.decision === "match") tp += 1;
      else fn += 1;
    } else {
      negatives += 1;
      if (result.decision === "nonmatch") tn += 1;
      else fp += 1;
    }
  }

  return {
    pairCount: pairs.length,
    coveredPairCount: covered,
    abstainedPairCount: pairs.length - covered,
    coverage: pairs.length === 0 ? 0 : covered / pairs.length,
    truePositiveRate: rate(tp, positives),
    falsePositiveRate: rate(fp, negatives),
    trueNegativeRate: rate(tn, negatives),
    falseNegativeRate: rate(fn, positives),
  };
}
