export interface CaptureConfig {
  readonly warmupMs: number;
  readonly preTriggerMs: number;
  readonly postTriggerMs: number;
  readonly minRms: number;
  readonly minPeak: number;
  readonly rmsNoiseMultiplier: number;
  readonly peakNoiseMultiplier: number;
  readonly noiseSmoothing: number;
}

export const DEFAULT_CAPTURE_CONFIG: CaptureConfig = {
  warmupMs: 500,
  preTriggerMs: 120,
  postTriggerMs: 2800,
  minRms: 0.012,
  minPeak: 0.05,
  rmsNoiseMultiplier: 6,
  peakNoiseMultiplier: 4,
  noiseSmoothing: 0.05,
};
