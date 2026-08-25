import { CURRENT_ACOUSTIC_FINGERPRINT_ALGORITHM_VERSION } from "../modes/types";
import { analyzeImpact, type AnalysisFailureReason } from "./analyze-impact";

export const ER_DSP_2_FAILURE_MAP_REGIMES = [
  "close-overlapping-modes",
  "near-degenerate-modes",
  "short-decay",
  "broad-resonances",
  "coupled-modes",
  "low-snr",
] as const;

export type ErDsp2FailureMapRegimeId = (typeof ER_DSP_2_FAILURE_MAP_REGIMES)[number];

export interface SyntheticTrueModeV1 {
  readonly frequencyHz: number;
  readonly decaySeconds: number;
}

export interface DspFailureMapCaseResultV1 {
  readonly regimeId: ErDsp2FailureMapRegimeId;
  readonly analysisOk: boolean;
  readonly analysisFailureReason: AnalysisFailureReason | null;
  readonly trueModeCount: number;
  readonly recoveredModeCount: number;
  readonly matchedModeCount: number;
  readonly precision: number | null;
  readonly recall: number | null;
  readonly duplicateModeRate: number;
  readonly medianFrequencyErrorCents: number | null;
  readonly medianRelativeDecayError: number | null;
  readonly notes: readonly string[];
}

/**
 * Research diagnostic report for where the frozen FFT / peak-tracking /
 * decay-fitting pipeline fails on synthetic ground truth.
 *
 * Not a release gate and not evidence-eligible. Mapping `er-dsp-2` does
 * not stamp a new fingerprint algorithm version onto research output.
 */
export interface DspFailureMapReportV1 {
  readonly reportVersion: "er-dsp-2-failure-map-1";
  readonly mappedAlgorithmVersion: "er-dsp-2";
  readonly evidenceEligible: false;
  readonly releaseGateEquivalent: false;
  readonly caseCount: number;
  readonly cases: readonly DspFailureMapCaseResultV1[];
}

function centsDistance(leftHz: number, rightHz: number): number {
  if (!(leftHz > 0) || !(rightHz > 0)) return Number.POSITIVE_INFINITY;
  return 1200 * Math.abs(Math.log2(rightHz / leftHz));
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle]!;
  return (ordered[middle - 1]! + ordered[middle]!) / 2;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function matchModes(
  recovered: readonly { frequencyHz: number; decaySeconds: number }[],
  truth: readonly SyntheticTrueModeV1[],
  associationCents: number,
): { matched: number; frequencyErrors: number[]; decayErrors: number[] } {
  const usedRecovered = new Set<number>();
  const frequencyErrors: number[] = [];
  const decayErrors: number[] = [];
  let matched = 0;
  for (const trueMode of truth) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < recovered.length; index += 1) {
      if (usedRecovered.has(index)) continue;
      const distance = centsDistance(trueMode.frequencyHz, recovered[index]!.frequencyHz);
      if (distance < bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    }
    if (bestIndex >= 0 && bestDistance <= associationCents) {
      usedRecovered.add(bestIndex);
      matched += 1;
      frequencyErrors.push(bestDistance);
      const recoveredDecay = recovered[bestIndex]!.decaySeconds;
      decayErrors.push(Math.abs(recoveredDecay - trueMode.decaySeconds) / trueMode.decaySeconds);
    }
  }
  return { matched, frequencyErrors, decayErrors };
}

function duplicateModeRate(
  frequencies: readonly number[],
  duplicateDistanceCents: number,
): number {
  if (frequencies.length === 0) return 0;
  let duplicates = 0;
  for (let left = 0; left < frequencies.length; left += 1) {
    for (let right = left + 1; right < frequencies.length; right += 1) {
      if (centsDistance(frequencies[left]!, frequencies[right]!) <= duplicateDistanceCents) duplicates += 1;
    }
  }
  return duplicates / frequencies.length;
}

function notesForCase(result: Omit<DspFailureMapCaseResultV1, "notes">): string[] {
  const notes: string[] = [];
  if (!result.analysisOk && result.analysisFailureReason !== null) {
    notes.push(`analysis failed: ${result.analysisFailureReason}`);
  }
  if (result.recoveredModeCount < result.trueModeCount) {
    notes.push("under-count: modes were merged, rejected, or never tracked");
  }
  if (result.recoveredModeCount > result.trueModeCount) {
    notes.push("over-count: spurious or split tracks");
  }
  if (result.medianFrequencyErrorCents !== null && result.medianFrequencyErrorCents > 25) {
    notes.push("large median frequency error relative to synthetic truth");
  }
  if (result.medianRelativeDecayError !== null && result.medianRelativeDecayError > 0.5) {
    notes.push("large median relative decay error relative to synthetic truth");
  }
  if (result.recall !== null && result.recall < 1) {
    notes.push("recall is incomplete on this synthetic regime");
  }
  return notes;
}

export function evaluateErDsp2SyntheticFailureMapCase(options: {
  readonly regimeId: ErDsp2FailureMapRegimeId;
  readonly samples: Float32Array;
  readonly sampleRate: number;
  readonly trueModes: readonly SyntheticTrueModeV1[];
  readonly associationCents?: number;
  readonly duplicateDistanceCents?: number;
}): DspFailureMapCaseResultV1 {
  if (!(options.sampleRate > 0) || !Number.isFinite(options.sampleRate)) {
    throw new Error("failure-map sampleRate must be finite and positive");
  }
  if (options.trueModes.length === 0) throw new Error("failure-map case requires synthetic true modes");
  const associationCents = options.associationCents ?? 50;
  const duplicateDistanceCents = options.duplicateDistanceCents ?? 12;
  if (!(associationCents > 0) || !Number.isFinite(associationCents)) {
    throw new Error("associationCents must be finite and positive");
  }
  if (!(duplicateDistanceCents > 0) || !Number.isFinite(duplicateDistanceCents)) {
    throw new Error("duplicateDistanceCents must be finite and positive");
  }

  const analysis = analyzeImpact(options.samples, options.sampleRate);
  const recovered = analysis.ok ? analysis.fingerprint.modes : [];
  const matching = matchModes(recovered, options.trueModes, associationCents);
  const result = {
    regimeId: options.regimeId,
    analysisOk: analysis.ok,
    analysisFailureReason: analysis.ok ? null : analysis.reason,
    trueModeCount: options.trueModes.length,
    recoveredModeCount: recovered.length,
    matchedModeCount: matching.matched,
    precision: rate(matching.matched, recovered.length),
    recall: rate(matching.matched, options.trueModes.length),
    duplicateModeRate: duplicateModeRate(recovered.map((mode) => mode.frequencyHz), duplicateDistanceCents),
    medianFrequencyErrorCents: median(matching.frequencyErrors),
    medianRelativeDecayError: median(matching.decayErrors),
  };
  return { ...result, notes: notesForCase(result) };
}

export function compileErDsp2FailureMapReport(
  cases: readonly DspFailureMapCaseResultV1[],
): DspFailureMapReportV1 {
  if (cases.length === 0) throw new Error("failure-map report requires at least one case");
  if (CURRENT_ACOUSTIC_FINGERPRINT_ALGORITHM_VERSION !== "er-dsp-2") {
    throw new Error("er-dsp-2 failure map requires CURRENT_ACOUSTIC_FINGERPRINT_ALGORITHM_VERSION to remain er-dsp-2");
  }
  const ordered = [...cases].sort((left, right) => left.regimeId.localeCompare(right.regimeId, "en-US"));
  return {
    reportVersion: "er-dsp-2-failure-map-1",
    mappedAlgorithmVersion: "er-dsp-2",
    evidenceEligible: false,
    releaseGateEquivalent: false,
    caseCount: ordered.length,
    cases: ordered,
  };
}
