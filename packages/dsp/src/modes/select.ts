import type { AcousticMode } from "./types";

export interface ModeSelectionConfig {
  readonly minimumConfidence: number;
  readonly maximumModes: number;
  readonly duplicateDistanceCents: number;
}

export const DEFAULT_MODE_SELECTION_CONFIG: ModeSelectionConfig = {
  minimumConfidence: 0.55,
  maximumModes: 16,
  duplicateDistanceCents: 12,
};

function centsDistance(leftFrequencyHz: number, rightFrequencyHz: number): number {
  return 1200 * Math.abs(Math.log2(rightFrequencyHz / leftFrequencyHz));
}

export function selectAcousticModes(
  candidates: readonly AcousticMode[],
  config: ModeSelectionConfig = DEFAULT_MODE_SELECTION_CONFIG,
): AcousticMode[] {
  const eligible = candidates
    .filter((mode) => mode.confidence >= config.minimumConfidence)
    .sort((left, right) => left.frequencyHz - right.frequencyHz);
  const deduplicated: AcousticMode[] = [];

  for (const candidate of eligible) {
    const previous = deduplicated.at(-1);
    if (
      previous !== undefined &&
      centsDistance(previous.frequencyHz, candidate.frequencyHz) <= config.duplicateDistanceCents
    ) {
      if (candidate.confidence > previous.confidence) {
        deduplicated[deduplicated.length - 1] = candidate;
      }
      continue;
    }
    deduplicated.push(candidate);
  }

  return deduplicated
    .sort((left, right) => {
      const leftRank = left.confidence * (0.5 + 0.5 * Math.sqrt(left.relativeAmplitude));
      const rightRank = right.confidence * (0.5 + 0.5 * Math.sqrt(right.relativeAmplitude));
      return rightRank - leftRank;
    })
    .slice(0, config.maximumModes);
}
