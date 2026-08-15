import { interpolateQuadraticPeakDb } from "./quadratic";

export interface PeakDetectionConfig {
  readonly minimumFrequencyHz: number;
  readonly maximumFrequencyHz: number;
  readonly minimumProminenceDb: number;
  readonly neighborhoodBins: number;
  readonly exclusionBins: number;
}

export const DEFAULT_PEAK_DETECTION_CONFIG: PeakDetectionConfig = {
  minimumFrequencyHz: 80,
  maximumFrequencyHz: 12_000,
  minimumProminenceDb: 8,
  neighborhoodBins: 12,
  exclusionBins: 2,
};

export interface SpectralPeak {
  readonly binIndex: number;
  readonly frequencyHz: number;
  readonly magnitudeDb: number;
  readonly prominenceDb: number;
}

function median(values: number[]): number {
  if (values.length === 0) return Number.NEGATIVE_INFINITY;
  values.sort((left, right) => left - right);
  const middle = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[middle] ?? Number.NEGATIVE_INFINITY;
  return ((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2;
}

function localFloorDb(
  magnitudesDb: ArrayLike<number>,
  binIndex: number,
  config: PeakDetectionConfig,
): number {
  const values: number[] = [];
  const firstBin = Math.max(0, binIndex - config.neighborhoodBins);
  const lastBin = Math.min(magnitudesDb.length - 1, binIndex + config.neighborhoodBins);

  for (let candidateBin = firstBin; candidateBin <= lastBin; candidateBin += 1) {
    if (Math.abs(candidateBin - binIndex) <= config.exclusionBins) continue;
    const value = magnitudesDb[candidateBin];
    if (value !== undefined && Number.isFinite(value)) values.push(value);
  }
  return median(values);
}

export function detectSpectralPeaks(
  magnitudesDb: ArrayLike<number>,
  sampleRate: number,
  fftSize: number,
  config: PeakDetectionConfig = DEFAULT_PEAK_DETECTION_CONFIG,
): SpectralPeak[] {
  if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) {
    throw new RangeError(`Sample rate must be finite and positive; received ${sampleRate}`);
  }
  if (!(config.minimumFrequencyHz >= 0) || config.maximumFrequencyHz <= config.minimumFrequencyHz) {
    throw new RangeError("Peak frequency range is invalid");
  }
  if (!Number.isInteger(config.neighborhoodBins) || config.neighborhoodBins < 2) {
    throw new RangeError("Peak neighborhoodBins must be an integer >= 2");
  }
  if (!Number.isInteger(config.exclusionBins) || config.exclusionBins < 0 || config.exclusionBins >= config.neighborhoodBins) {
    throw new RangeError("Peak exclusionBins must be an integer in [0, neighborhoodBins)");
  }

  const binCount = magnitudesDb.length;
  const minimumBin = Math.max(1, Math.ceil((config.minimumFrequencyHz * fftSize) / sampleRate));
  const maximumByFrequency = Math.floor((config.maximumFrequencyHz * fftSize) / sampleRate);
  const maximumBin = Math.min(binCount - 2, maximumByFrequency);
  const peaks: SpectralPeak[] = [];

  for (let binIndex = minimumBin; binIndex <= maximumBin; binIndex += 1) {
    const left = magnitudesDb[binIndex - 1] ?? Number.NEGATIVE_INFINITY;
    const center = magnitudesDb[binIndex] ?? Number.NEGATIVE_INFINITY;
    const right = magnitudesDb[binIndex + 1] ?? Number.NEGATIVE_INFINITY;
    if (!(center > left && center >= right)) continue;

    const floorDb = localFloorDb(magnitudesDb, binIndex, config);
    const interpolated = interpolateQuadraticPeakDb(magnitudesDb, binIndex, sampleRate, fftSize);
    const prominenceDb = interpolated.magnitudeDb - floorDb;
    if (prominenceDb < config.minimumProminenceDb) continue;

    peaks.push({
      binIndex,
      frequencyHz: interpolated.frequencyHz,
      magnitudeDb: interpolated.magnitudeDb,
      prominenceDb,
    });
  }

  return peaks;
}
