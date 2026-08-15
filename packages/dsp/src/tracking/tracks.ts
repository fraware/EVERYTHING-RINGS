import type { SpectralPeak } from "../peaks/detect";

export interface SpectralPeakFrame {
  readonly frameIndex: number;
  readonly timeSeconds: number;
  readonly peaks: readonly SpectralPeak[];
}

export interface PeakTrackObservation extends SpectralPeak {
  readonly frameIndex: number;
  readonly timeSeconds: number;
}

export interface PeakTrack {
  readonly id: number;
  readonly observations: readonly PeakTrackObservation[];
}

export interface PeakTrackingConfig {
  readonly maximumDistanceCents: number;
  readonly minimumDistanceHz: number;
  readonly maximumMissedFrames: number;
}

export const DEFAULT_PEAK_TRACKING_CONFIG: PeakTrackingConfig = {
  maximumDistanceCents: 25,
  minimumDistanceHz: 3,
  maximumMissedFrames: 2,
};

interface MutableTrack {
  readonly id: number;
  readonly observations: PeakTrackObservation[];
  missedFrames: number;
  associationFrequencyHz: number;
  associationWeight: number;
}

function centsDistance(leftFrequencyHz: number, rightFrequencyHz: number): number {
  return 1200 * Math.abs(Math.log2(rightFrequencyHz / leftFrequencyHz));
}

function withinAssociationDistance(
  trackFrequencyHz: number,
  peakFrequencyHz: number,
  config: PeakTrackingConfig,
): { eligible: boolean; distanceCents: number } {
  const absoluteDistanceHz = Math.abs(peakFrequencyHz - trackFrequencyHz);
  const distanceCents = centsDistance(trackFrequencyHz, peakFrequencyHz);
  return {
    eligible:
      distanceCents <= config.maximumDistanceCents ||
      absoluteDistanceHz <= config.minimumDistanceHz,
    distanceCents,
  };
}

function observationWeight(magnitudeDb: number): number {
  return 10 ** (magnitudeDb / 20);
}

export function trackSpectralPeaks(
  frames: readonly SpectralPeakFrame[],
  config: PeakTrackingConfig = DEFAULT_PEAK_TRACKING_CONFIG,
): PeakTrack[] {
  if (!(config.maximumDistanceCents > 0) || !(config.minimumDistanceHz >= 0)) {
    throw new RangeError("Peak tracking distance thresholds are invalid");
  }
  if (!Number.isInteger(config.maximumMissedFrames) || config.maximumMissedFrames < 0) {
    throw new RangeError("maximumMissedFrames must be a non-negative integer");
  }

  const active: MutableTrack[] = [];
  const completed: MutableTrack[] = [];
  let nextTrackId = 0;
  let previousFrameIndex = -1;

  for (const frame of frames) {
    if (!Number.isInteger(frame.frameIndex) || frame.frameIndex < 0) {
      throw new RangeError("Peak frameIndex values must be non-negative integers");
    }
    if (previousFrameIndex >= 0 && frame.frameIndex !== previousFrameIndex + 1) {
      throw new RangeError("Peak frames must be contiguous; represent missing detections with an empty frame");
    }
    previousFrameIndex = frame.frameIndex;

    const assignedTrackIds = new Set<number>();
    const orderedPeaks = [...frame.peaks].sort(
      (left, right) => right.prominenceDb - left.prominenceDb,
    );

    for (const peak of orderedPeaks) {
      let bestTrack: MutableTrack | undefined;
      let bestDistanceCents = Number.POSITIVE_INFINITY;

      for (const track of active) {
        if (assignedTrackIds.has(track.id)) continue;
        const distance = withinAssociationDistance(
          track.associationFrequencyHz,
          peak.frequencyHz,
          config,
        );
        if (distance.eligible && distance.distanceCents < bestDistanceCents) {
          bestTrack = track;
          bestDistanceCents = distance.distanceCents;
        }
      }

      const observation: PeakTrackObservation = {
        ...peak,
        frameIndex: frame.frameIndex,
        timeSeconds: frame.timeSeconds,
      };

      if (bestTrack === undefined) {
        const weight = observationWeight(peak.magnitudeDb);
        const track: MutableTrack = {
          id: nextTrackId,
          observations: [observation],
          missedFrames: 0,
          associationFrequencyHz: peak.frequencyHz,
          associationWeight: weight,
        };
        nextTrackId += 1;
        active.push(track);
        assignedTrackIds.add(track.id);
        continue;
      }

      bestTrack.observations.push(observation);
      bestTrack.missedFrames = 0;
      const weight = observationWeight(peak.magnitudeDb);
      const totalWeight = bestTrack.associationWeight + weight;
      bestTrack.associationFrequencyHz =
        (bestTrack.associationFrequencyHz * bestTrack.associationWeight + peak.frequencyHz * weight) /
        totalWeight;
      bestTrack.associationWeight = totalWeight;
      assignedTrackIds.add(bestTrack.id);
    }

    for (let index = active.length - 1; index >= 0; index -= 1) {
      const track = active[index];
      if (track === undefined || assignedTrackIds.has(track.id)) continue;
      track.missedFrames += 1;
      if (track.missedFrames > config.maximumMissedFrames) {
        completed.push(track);
        active.splice(index, 1);
      }
    }
  }

  completed.push(...active);
  return completed
    .sort((left, right) => left.id - right.id)
    .map((track) => ({ id: track.id, observations: track.observations }));
}
