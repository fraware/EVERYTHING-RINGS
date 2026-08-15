export interface RobustLineConfig {
  readonly huberDelta: number;
  readonly maximumIterations: number;
  readonly convergenceTolerance: number;
}

export const DEFAULT_ROBUST_LINE_CONFIG: RobustLineConfig = {
  huberDelta: 1.345,
  maximumIterations: 20,
  convergenceTolerance: 1e-9,
};

export interface RobustLineFit {
  readonly intercept: number;
  readonly slope: number;
  readonly score: number;
  readonly residualScale: number;
  readonly iterations: number;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? Number.NaN;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function weightedLeastSquares(
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  weights: ArrayLike<number>,
): { intercept: number; slope: number } {
  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let index = 0; index < x.length; index += 1) {
    const weight = weights[index] ?? 0;
    totalWeight += weight;
    weightedX += weight * (x[index] ?? 0);
    weightedY += weight * (y[index] ?? 0);
  }
  if (!(totalWeight > 0)) throw new RangeError("Robust line fit has zero total weight");

  const meanX = weightedX / totalWeight;
  const meanY = weightedY / totalWeight;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < x.length; index += 1) {
    const weight = weights[index] ?? 0;
    const centeredX = (x[index] ?? 0) - meanX;
    numerator += weight * centeredX * ((y[index] ?? 0) - meanY);
    denominator += weight * centeredX * centeredX;
  }
  if (!(denominator > Number.EPSILON)) throw new RangeError("Robust line fit requires variation in x");

  const slope = numerator / denominator;
  return { intercept: meanY - slope * meanX, slope };
}

function residualScale(residuals: readonly number[]): number {
  const center = median(residuals);
  const absoluteDeviations = residuals.map((residual) => Math.abs(residual - center));
  return Math.max(1.4826 * median(absoluteDeviations), 1e-12);
}

export function fitRobustLine(
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  config: RobustLineConfig = DEFAULT_ROBUST_LINE_CONFIG,
): RobustLineFit {
  if (x.length !== y.length || x.length < 2) {
    throw new RangeError("Robust line fit requires equal-length inputs with at least two samples");
  }
  if (!(config.huberDelta > 0) || config.maximumIterations < 1 || !(config.convergenceTolerance > 0)) {
    throw new RangeError("Robust line configuration is invalid");
  }

  const weights = new Float64Array(x.length).fill(1);
  let fit = weightedLeastSquares(x, y, weights);
  let scale = 0;
  let iterations = 0;

  for (iterations = 1; iterations <= config.maximumIterations; iterations += 1) {
    const residuals = Array.from({ length: x.length }, (_, index) =>
      (y[index] ?? 0) - (fit.intercept + fit.slope * (x[index] ?? 0)),
    );
    scale = residualScale(residuals);
    const cutoff = config.huberDelta * scale;
    for (let index = 0; index < residuals.length; index += 1) {
      const magnitude = Math.abs(residuals[index] ?? 0);
      weights[index] = magnitude <= cutoff ? 1 : cutoff / magnitude;
    }

    const nextFit = weightedLeastSquares(x, y, weights);
    const change = Math.max(
      Math.abs(nextFit.intercept - fit.intercept),
      Math.abs(nextFit.slope - fit.slope),
    );
    fit = nextFit;
    if (change <= config.convergenceTolerance) break;
  }

  const residuals = Array.from({ length: x.length }, (_, index) =>
    (y[index] ?? 0) - (fit.intercept + fit.slope * (x[index] ?? 0)),
  );
  scale = residualScale(residuals);
  const values = Array.from({ length: y.length }, (_, index) => y[index] ?? 0);
  const meanY = values.reduce((sum, value) => sum + value, 0) / values.length;
  const residualSumSquares = residuals.reduce((sum, residual) => sum + residual * residual, 0);
  const totalSumSquares = values.reduce((sum, value) => sum + (value - meanY) ** 2, 0);
  const rawScore = totalSumSquares > Number.EPSILON ? 1 - residualSumSquares / totalSumSquares : 0;

  return {
    intercept: fit.intercept,
    slope: fit.slope,
    score: Math.max(0, Math.min(1, rawScore)),
    residualScale: scale,
    iterations: Math.min(iterations, config.maximumIterations),
  };
}
