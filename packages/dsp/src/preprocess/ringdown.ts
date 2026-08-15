export interface ImpactOnsetConfig {
  readonly searchBackwardMs: number;
  readonly searchForwardMs: number;
  readonly energyWindowMs: number;
  readonly analysisDelayMs: number;
}

export const DEFAULT_IMPACT_ONSET_CONFIG: ImpactOnsetConfig = {
  searchBackwardMs: 40,
  searchForwardMs: 5,
  energyWindowMs: 1.5,
  analysisDelayMs: 15,
};

export interface RingdownSignal {
  readonly samples: Float32Array;
  readonly refinedOnsetSample: number;
  readonly analysisStartSample: number;
}

function millisecondsToSamples(milliseconds: number, sampleRate: number): number {
  return Math.max(1, Math.round((milliseconds / 1000) * sampleRate));
}

function validateInputs(samples: Float32Array, sampleRate: number, coarseOnsetSample: number): void {
  if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) {
    throw new RangeError(`Sample rate must be finite and positive; received ${sampleRate}`);
  }
  if (!Number.isInteger(coarseOnsetSample) || coarseOnsetSample < 0 || coarseOnsetSample >= samples.length) {
    throw new RangeError("Coarse onset sample lies outside the signal");
  }
}

export function refineImpactOnset(
  samples: Float32Array,
  sampleRate: number,
  coarseOnsetSample: number,
  config: ImpactOnsetConfig = DEFAULT_IMPACT_ONSET_CONFIG,
): number {
  validateInputs(samples, sampleRate, coarseOnsetSample);
  const windowSamples = millisecondsToSamples(config.energyWindowMs, sampleRate);
  const searchStart = Math.max(windowSamples, coarseOnsetSample - millisecondsToSamples(config.searchBackwardMs, sampleRate));
  const searchEnd = Math.min(
    samples.length - windowSamples,
    coarseOnsetSample + millisecondsToSamples(config.searchForwardMs, sampleRate),
  );
  if (searchEnd <= searchStart) return coarseOnsetSample;

  const squaredPrefix = new Float64Array(samples.length + 1);
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index] ?? 0;
    squaredPrefix[index + 1] = (squaredPrefix[index] ?? 0) + value * value;
  }

  const energy = (start: number, end: number): number =>
    ((squaredPrefix[end] ?? 0) - (squaredPrefix[start] ?? 0)) / Math.max(1, end - start);

  let bestSample = coarseOnsetSample;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let candidate = searchStart; candidate <= searchEnd; candidate += 1) {
    const before = energy(candidate - windowSamples, candidate);
    const after = energy(candidate, candidate + windowSamples);
    const score = after - before;
    if (score > bestScore) {
      bestScore = score;
      bestSample = candidate;
    }
  }
  return bestSample;
}

export function extractImpactRingdown(
  samples: Float32Array,
  sampleRate: number,
  coarseOnsetSample: number,
  config: ImpactOnsetConfig = DEFAULT_IMPACT_ONSET_CONFIG,
): RingdownSignal {
  const refinedOnsetSample = refineImpactOnset(samples, sampleRate, coarseOnsetSample, config);
  const analysisStartSample = Math.min(
    samples.length,
    refinedOnsetSample + millisecondsToSamples(config.analysisDelayMs, sampleRate),
  );
  return {
    samples: samples.slice(analysisStartSample),
    refinedOnsetSample,
    analysisStartSample,
  };
}
