export function findMaximumBin(
  magnitudesDb: ArrayLike<number>,
  minimumBinIndex: number,
  maximumBinIndex: number,
): number {
  if (minimumBinIndex < 1 || maximumBinIndex >= magnitudesDb.length - 1) {
    throw new RangeError("Search range must leave one neighboring FFT bin on each side");
  }
  if (minimumBinIndex > maximumBinIndex) {
    throw new RangeError("Minimum FFT bin must not exceed maximum FFT bin");
  }

  let bestBinIndex = minimumBinIndex;
  let bestMagnitudeDb = magnitudesDb[minimumBinIndex] ?? Number.NEGATIVE_INFINITY;
  for (let binIndex = minimumBinIndex + 1; binIndex <= maximumBinIndex; binIndex += 1) {
    const magnitudeDb = magnitudesDb[binIndex] ?? Number.NEGATIVE_INFINITY;
    if (magnitudeDb > bestMagnitudeDb) {
      bestMagnitudeDb = magnitudeDb;
      bestBinIndex = binIndex;
    }
  }
  return bestBinIndex;
}
