import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";

export interface ModeRecurrenceConfig {
  readonly referenceModeLimit: number;
  readonly candidateModeLimit: number;
  readonly unmatchedPenaltyCents: number;
}

export const DEFAULT_MODE_RECURRENCE_CONFIG: ModeRecurrenceConfig = {
  referenceModeLimit: 8,
  candidateModeLimit: 16,
  unmatchedPenaltyCents: 600,
};

export interface ModeMatch {
  readonly referenceIndex: number;
  readonly candidateIndex?: number;
  readonly referenceFrequencyHz: number;
  readonly candidateFrequencyHz?: number;
  readonly distanceCents: number;
}

export interface FingerprintRecurrence {
  readonly medianCents: number;
  readonly meanCents: number;
  readonly matchedCount: number;
  readonly unmatchedReferenceCount: number;
  readonly matches: readonly ModeMatch[];
}

export function centsDistance(leftHz: number, rightHz: number): number {
  if (!(leftHz > 0) || !(rightHz > 0)) return Number.POSITIVE_INFINITY;
  return 1200 * Math.abs(Math.log2(rightHz / leftHz));
}

function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle] ?? Number.NaN;
  return ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2;
}

interface AssignmentState {
  readonly cost: number;
  readonly choices: readonly (number | undefined)[];
}

function optimalAssignment(
  reference: readonly AcousticMode[],
  candidates: readonly AcousticMode[],
  unmatchedPenaltyCents: number,
): AssignmentState {
  if (candidates.length > 30) throw new RangeError("At most 30 candidate modes are supported");
  const memo = new Map<string, AssignmentState>();

  function solve(referenceIndex: number, usedMask: number): AssignmentState {
    if (referenceIndex >= reference.length) return { cost: 0, choices: [] };
    const key = `${referenceIndex}:${usedMask}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const skipped = solve(referenceIndex + 1, usedMask);
    let best: AssignmentState = {
      cost: unmatchedPenaltyCents + skipped.cost,
      choices: [undefined, ...skipped.choices],
    };

    const sourceMode = reference[referenceIndex];
    if (sourceMode === undefined) return best;
    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      const bit = 1 << candidateIndex;
      if ((usedMask & bit) !== 0) continue;
      const candidate = candidates[candidateIndex];
      if (candidate === undefined) continue;
      const distance = centsDistance(sourceMode.frequencyHz, candidate.frequencyHz);
      const tail = solve(referenceIndex + 1, usedMask | bit);
      const cost = Math.min(distance, unmatchedPenaltyCents * 2) + tail.cost;
      if (cost < best.cost) {
        best = { cost, choices: [candidateIndex, ...tail.choices] };
      }
    }
    memo.set(key, best);
    return best;
  }

  return solve(0, 0);
}

export function fingerprintRecurrence(
  referenceFingerprint: AcousticFingerprintV1,
  candidateFingerprint: AcousticFingerprintV1,
  config: ModeRecurrenceConfig = DEFAULT_MODE_RECURRENCE_CONFIG,
): FingerprintRecurrence {
  if (!Number.isInteger(config.referenceModeLimit) || config.referenceModeLimit <= 0) {
    throw new RangeError("referenceModeLimit must be a positive integer");
  }
  if (!Number.isInteger(config.candidateModeLimit) || config.candidateModeLimit <= 0 || config.candidateModeLimit > 30) {
    throw new RangeError("candidateModeLimit must be an integer in [1, 30]");
  }
  if (!(config.unmatchedPenaltyCents > 0) || !Number.isFinite(config.unmatchedPenaltyCents)) {
    throw new RangeError("unmatchedPenaltyCents must be finite and positive");
  }

  const reference = referenceFingerprint.modes.slice(0, config.referenceModeLimit);
  const candidates = candidateFingerprint.modes.slice(0, config.candidateModeLimit);
  if (reference.length === 0) {
    return { medianCents: Number.NaN, meanCents: Number.NaN, matchedCount: 0, unmatchedReferenceCount: 0, matches: [] };
  }

  const assignment = optimalAssignment(reference, candidates, config.unmatchedPenaltyCents);
  const matches: ModeMatch[] = reference.map((mode, referenceIndex) => {
    const candidateIndex = assignment.choices[referenceIndex];
    if (candidateIndex === undefined) {
      return {
        referenceIndex,
        referenceFrequencyHz: mode.frequencyHz,
        distanceCents: config.unmatchedPenaltyCents,
      };
    }
    const candidate = candidates[candidateIndex];
    if (candidate === undefined) throw new Error("Assignment referenced a missing candidate mode");
    return {
      referenceIndex,
      candidateIndex,
      referenceFrequencyHz: mode.frequencyHz,
      candidateFrequencyHz: candidate.frequencyHz,
      distanceCents: centsDistance(mode.frequencyHz, candidate.frequencyHz),
    };
  });
  const distances = matches.map((match) => match.distanceCents);
  const matchedCount = matches.filter((match) => match.candidateIndex !== undefined).length;
  return {
    medianCents: median(distances),
    meanCents: distances.reduce((sum, value) => sum + value, 0) / distances.length,
    matchedCount,
    unmatchedReferenceCount: matches.length - matchedCount,
    matches,
  };
}
