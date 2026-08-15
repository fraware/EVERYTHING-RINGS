export interface InterpolatedPeak {
  readonly binOffset: number;
  readonly binPosition: number;
  readonly frequencyHz: number;
  readonly magnitudeDb: number;
}

export function interpolateQuadraticPeakDb(
  magnitudesDb: ArrayLike<number>,
  peakBinIndex: number,
  sampleRate: number,
  fftSize: number,
): InterpolatedPeak {
  if (peakBinIndex <= 0 || peakBinIndex >= magnitudesDb.length - 1) {
    throw new RangeError("Quadratic interpolation requires one neighboring bin on each side");
  }
  if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) {
    throw new RangeError(`Sample rate must be finite and positive; received ${sampleRate}`);
  }

  const alpha = magnitudesDb[peakBinIndex - 1] ?? Number.NEGATIVE_INFINITY;
  const beta = magnitudesDb[peakBinIndex] ?? Number.NEGATIVE_INFINITY;
  const gamma = magnitudesDb[peakBinIndex + 1] ?? Number.NEGATIVE_INFINITY;
  const denominator = alpha - 2 * beta + gamma;

  let binOffset = 0;
  if (Number.isFinite(denominator) && Math.abs(denominator) > 1e-12) {
    binOffset = 0.5 * (alpha - gamma) / denominator;
  }
  binOffset = Math.max(-0.5, Math.min(0.5, binOffset));

  const binPosition = peakBinIndex + binOffset;
  return {
    binOffset,
    binPosition,
    frequencyHz: (binPosition * sampleRate) / fftSize,
    magnitudeDb: beta - 0.25 * (alpha - gamma) * binOffset,
  };
}
