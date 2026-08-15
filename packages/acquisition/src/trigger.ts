import type { CaptureConfig } from "./config";

export interface BlockMetrics {
  readonly rms: number;
  readonly peak: number;
  readonly peakIndex: number;
}

export function measureBlock(samples: Float32Array): BlockMetrics {
  if (samples.length === 0) return { rms: 0, peak: 0, peakIndex: 0 };
  let sumSquares = 0;
  let peak = 0;
  let peakIndex = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index] ?? 0;
    const absolute = Math.abs(value);
    sumSquares += value * value;
    if (absolute > peak) {
      peak = absolute;
      peakIndex = index;
    }
  }
  return { rms: Math.sqrt(sumSquares / samples.length), peak, peakIndex };
}

export function shouldTrigger(
  metrics: BlockMetrics,
  noiseRms: number,
  noisePeak: number,
  config: CaptureConfig,
): boolean {
  const rmsThreshold = Math.max(config.minRms, noiseRms * config.rmsNoiseMultiplier);
  const peakThreshold = Math.max(config.minPeak, noisePeak * config.peakNoiseMultiplier);
  return metrics.rms > rmsThreshold && metrics.peak > peakThreshold;
}
