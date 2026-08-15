import type { PeakTrackSummary } from "../tracking/stability";
import type { PeakTrack } from "../tracking/tracks";
import { DEFAULT_ROBUST_LINE_CONFIG, fitRobustLine, type RobustLineConfig } from "./robust-line";

const DB_TO_NATURAL_LOG_AMPLITUDE = Math.LN10 / 20;

export interface DecayFitConfig {
  readonly minimumObservations: number;
  readonly minimumTailProminenceDb: number;
  readonly robustLine: RobustLineConfig;
}

export const DEFAULT_DECAY_FIT_CONFIG: DecayFitConfig = {
  minimumObservations: 6,
  minimumTailProminenceDb: 6,
  robustLine: DEFAULT_ROBUST_LINE_CONFIG,
};

export type DecayFitFailureReason =
  | "INSUFFICIENT_OBSERVATIONS"
  | "NON_DECAYING"
  | "INVALID_FIT";

export interface DecayEstimate {
  readonly decaySeconds: number;
  readonly q: number;
  readonly slopePerSecond: number;
  readonly fitScore: number;
  readonly residualScale: number;
  readonly observationCount: number;
  readonly startTimeSeconds: number;
  readonly endTimeSeconds: number;
}

export type DecayFitResult =
  | { readonly ok: true; readonly estimate: DecayEstimate }
  | { readonly ok: false; readonly reason: DecayFitFailureReason };

export function estimateTrackDecay(
  track: PeakTrack,
  summary: PeakTrackSummary,
  config: DecayFitConfig = DEFAULT_DECAY_FIT_CONFIG,
): DecayFitResult {
  if (track.observations.length < config.minimumObservations) {
    return { ok: false, reason: "INSUFFICIENT_OBSERVATIONS" };
  }

  let maximumIndex = 0;
  for (let index = 1; index < track.observations.length; index += 1) {
    if (
      (track.observations[index]?.magnitudeDb ?? Number.NEGATIVE_INFINITY) >
      (track.observations[maximumIndex]?.magnitudeDb ?? Number.NEGATIVE_INFINITY)
    ) {
      maximumIndex = index;
    }
  }

  const fitObservations = [] as typeof track.observations[number][];
  for (let index = maximumIndex; index < track.observations.length; index += 1) {
    const observation = track.observations[index];
    if (observation === undefined) continue;
    if (observation.prominenceDb < config.minimumTailProminenceDb) break;
    fitObservations.push(observation);
  }
  if (fitObservations.length < config.minimumObservations) {
    return { ok: false, reason: "INSUFFICIENT_OBSERVATIONS" };
  }

  const startTimeSeconds = fitObservations[0]?.timeSeconds ?? 0;
  const x = Float64Array.from(
    fitObservations,
    (observation) => observation.timeSeconds - startTimeSeconds,
  );
  const y = Float64Array.from(
    fitObservations,
    (observation) => observation.magnitudeDb * DB_TO_NATURAL_LOG_AMPLITUDE,
  );

  let fit;
  try {
    fit = fitRobustLine(x, y, config.robustLine);
  } catch {
    return { ok: false, reason: "INVALID_FIT" };
  }
  if (!Number.isFinite(fit.slope) || !Number.isFinite(fit.intercept)) {
    return { ok: false, reason: "INVALID_FIT" };
  }
  if (!(fit.slope < 0)) {
    return { ok: false, reason: "NON_DECAYING" };
  }

  const decaySeconds = -1 / fit.slope;
  if (!(decaySeconds > 0) || !Number.isFinite(decaySeconds)) {
    return { ok: false, reason: "INVALID_FIT" };
  }

  return {
    ok: true,
    estimate: {
      decaySeconds,
      q: Math.PI * summary.frequencyHz * decaySeconds,
      slopePerSecond: fit.slope,
      fitScore: fit.score,
      residualScale: fit.residualScale,
      observationCount: fitObservations.length,
      startTimeSeconds,
      endTimeSeconds: fitObservations.at(-1)?.timeSeconds ?? startTimeSeconds,
    },
  };
}
