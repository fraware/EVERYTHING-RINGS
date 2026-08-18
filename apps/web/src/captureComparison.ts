import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";
import { centsDistance } from "@everything-rings/fingerprint";

export interface CaptureObservationSummary {
  readonly modeCount: number;
  readonly lowestFrequencyHz?: number;
  readonly highestFrequencyHz?: number;
  readonly strongestFrequencyHz?: number;
  readonly longestDecaySeconds?: number;
}

export interface MutualNearestFrequencyPair {
  readonly leftModeIndex: number;
  readonly rightModeIndex: number;
  readonly leftFrequencyHz: number;
  readonly rightFrequencyHz: number;
  readonly distanceCents: number;
}

function finitePositiveModes(fingerprint: AcousticFingerprintV1): readonly AcousticMode[] {
  return fingerprint.modes.filter((mode) => Number.isFinite(mode.frequencyHz) && mode.frequencyHz > 0);
}

export function summarizeCaptureObservation(
  fingerprint: AcousticFingerprintV1,
): CaptureObservationSummary {
  const modes = finitePositiveModes(fingerprint);
  if (modes.length === 0) return { modeCount: 0 };

  let lowestFrequencyHz = Number.POSITIVE_INFINITY;
  let highestFrequencyHz = 0;
  let strongest = modes[0];
  let longest = modes[0];
  for (const mode of modes) {
    lowestFrequencyHz = Math.min(lowestFrequencyHz, mode.frequencyHz);
    highestFrequencyHz = Math.max(highestFrequencyHz, mode.frequencyHz);
    if (strongest === undefined || mode.relativeAmplitude > strongest.relativeAmplitude) strongest = mode;
    if (longest === undefined || mode.decaySeconds > longest.decaySeconds) longest = mode;
  }

  return {
    modeCount: modes.length,
    lowestFrequencyHz,
    highestFrequencyHz,
    strongestFrequencyHz: strongest?.frequencyHz,
    longestDecaySeconds: longest?.decaySeconds,
  };
}

function nearestModeIndex(
  source: AcousticMode,
  candidates: readonly AcousticMode[],
): number | undefined {
  let bestIndex: number | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (candidate === undefined || !(candidate.frequencyHz > 0) || !Number.isFinite(candidate.frequencyHz)) continue;
    const distance = centsDistance(source.frequencyHz, candidate.frequencyHz);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

export function mutualNearestFrequencyPairs(
  left: AcousticFingerprintV1,
  right: AcousticFingerprintV1,
): readonly MutualNearestFrequencyPair[] {
  const leftModes = left.modes;
  const rightModes = right.modes;
  if (leftModes.length === 0 || rightModes.length === 0) return [];

  const leftToRight = leftModes.map((mode) => nearestModeIndex(mode, rightModes));
  const rightToLeft = rightModes.map((mode) => nearestModeIndex(mode, leftModes));
  const pairs: MutualNearestFrequencyPair[] = [];

  for (let leftModeIndex = 0; leftModeIndex < leftModes.length; leftModeIndex += 1) {
    const rightModeIndex = leftToRight[leftModeIndex];
    if (rightModeIndex === undefined || rightToLeft[rightModeIndex] !== leftModeIndex) continue;
    const leftMode = leftModes[leftModeIndex];
    const rightMode = rightModes[rightModeIndex];
    if (leftMode === undefined || rightMode === undefined) continue;
    pairs.push({
      leftModeIndex,
      rightModeIndex,
      leftFrequencyHz: leftMode.frequencyHz,
      rightFrequencyHz: rightMode.frequencyHz,
      distanceCents: centsDistance(leftMode.frequencyHz, rightMode.frequencyHz),
    });
  }

  return pairs.sort((a, b) => (
    a.leftFrequencyHz - b.leftFrequencyHz
    || a.rightFrequencyHz - b.rightFrequencyHz
    || a.leftModeIndex - b.leftModeIndex
    || a.rightModeIndex - b.rightModeIndex
  ));
}
