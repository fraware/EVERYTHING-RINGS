import type { PeakTrack, PeakTrackObservation } from "./tracks";

export interface TrackAcceptanceConfig {
  readonly minimumObservations: number;
  readonly minimumDurationSeconds: number;
  readonly maximumFrequencyStdCents: number;
}

export const DEFAULT_TRACK_ACCEPTANCE_CONFIG: TrackAcceptanceConfig = {
  minimumObservations: 8,
  minimumDurationSeconds: 0.08,
  maximumFrequencyStdCents: 18,
};

export interface PeakTrackSummary {
  readonly trackId: number;
  readonly observationCount: number;
  readonly durationSeconds: number;
  readonly frequencyHz: number;
  readonly frequencyStdCents: number;
  readonly maximumProminenceDb: number;
}

function linearAmplitude(magnitudeDb: number): number {
  return 10 ** (magnitudeDb / 20);
}

function weightedMedianFrequencyHz(observations: readonly PeakTrackObservation[]): number {
  const entries = observations
    .map((observation) => ({
      frequencyHz: observation.frequencyHz,
      weight: linearAmplitude(observation.magnitudeDb),
    }))
    .sort((left, right) => left.frequencyHz - right.frequencyHz);
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const targetWeight = totalWeight / 2;
  let cumulativeWeight = 0;

  for (const entry of entries) {
    cumulativeWeight += entry.weight;
    if (cumulativeWeight >= targetWeight) return entry.frequencyHz;
  }

  return entries.at(-1)?.frequencyHz ?? Number.NaN;
}

export function summarizePeakTrack(track: PeakTrack): PeakTrackSummary {
  if (track.observations.length === 0) {
    throw new RangeError("Cannot summarize an empty peak track");
  }

  const frequencyHz = weightedMedianFrequencyHz(track.observations);
  const centsOffsets = track.observations.map(
    (observation) => 1200 * Math.log2(observation.frequencyHz / frequencyHz),
  );
  const meanCents = centsOffsets.reduce((sum, value) => sum + value, 0) / centsOffsets.length;
  const varianceCents =
    centsOffsets.reduce((sum, value) => sum + (value - meanCents) ** 2, 0) /
    centsOffsets.length;
  const first = track.observations[0];
  const last = track.observations.at(-1);

  return {
    trackId: track.id,
    observationCount: track.observations.length,
    durationSeconds: (last?.timeSeconds ?? 0) - (first?.timeSeconds ?? 0),
    frequencyHz,
    frequencyStdCents: Math.sqrt(varianceCents),
    maximumProminenceDb: Math.max(...track.observations.map((observation) => observation.prominenceDb)),
  };
}

export function isStablePeakTrack(
  summary: PeakTrackSummary,
  config: TrackAcceptanceConfig = DEFAULT_TRACK_ACCEPTANCE_CONFIG,
): boolean {
  return (
    summary.observationCount >= config.minimumObservations &&
    summary.durationSeconds >= config.minimumDurationSeconds &&
    summary.frequencyStdCents <= config.maximumFrequencyStdCents
  );
}
