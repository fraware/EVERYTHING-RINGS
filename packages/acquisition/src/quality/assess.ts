import type { AudioCapture } from "../types";

export interface CaptureQualityConfig {
  readonly clippingAmplitude: number;
  readonly maximumClippedFraction: number;
  readonly minimumPeakAmplitude: number;
  readonly minimumSnrDb: number;
  readonly strongSnrDb: number;
  readonly noiseWindowStartMs: number;
  readonly noiseWindowEndMs: number;
  readonly signalWindowStartMs: number;
  readonly signalWindowEndMs: number;
  readonly transientWindowMs: number;
  readonly secondarySearchStartMs: number;
  readonly maximumSecondaryTransientRatio: number;
}

export const DEFAULT_CAPTURE_QUALITY_CONFIG: CaptureQualityConfig = {
  clippingAmplitude: 0.985,
  maximumClippedFraction: 0.001,
  minimumPeakAmplitude: 0.02,
  minimumSnrDb: 12,
  strongSnrDb: 35,
  noiseWindowStartMs: -110,
  noiseWindowEndMs: -20,
  signalWindowStartMs: 20,
  signalWindowEndMs: 400,
  transientWindowMs: 10,
  secondarySearchStartMs: 100,
  maximumSecondaryTransientRatio: 0.65,
};

export interface CaptureQuality {
  readonly score: number;
  readonly snrDb: number;
  readonly clippedFraction: number;
  readonly peakAmplitude: number;
  readonly secondaryTransientRatio: number;
}

export type CaptureQualityFailureReason =
  | "TOO_QUIET"
  | "CLIPPED"
  | "LOW_SNR"
  | "MULTIPLE_IMPACTS";

export type CaptureQualityResult =
  | { readonly ok: true; readonly quality: CaptureQuality }
  | { readonly ok: false; readonly reason: CaptureQualityFailureReason; readonly quality: CaptureQuality };

function rms(samples: Float32Array, start: number, end: number): number {
  const lower = Math.max(0, Math.min(samples.length, start));
  const upper = Math.max(lower, Math.min(samples.length, end));
  if (upper <= lower) return 0;
  let sumSquares = 0;
  for (let index = lower; index < upper; index += 1) {
    const value = samples[index] ?? 0;
    sumSquares += value * value;
  }
  return Math.sqrt(sumSquares / (upper - lower));
}

function offsetSamples(milliseconds: number, sampleRate: number): number {
  return Math.round((milliseconds / 1000) * sampleRate);
}

function secondaryTransientRatio(capture: AudioCapture, config: CaptureQualityConfig): number {
  const windowSamples = Math.max(2, offsetSamples(config.transientWindowMs, capture.sampleRate));
  const searchStart = capture.triggerSample + offsetSamples(config.secondarySearchStartMs, capture.sampleRate);
  const primaryRms = rms(
    capture.samples,
    capture.triggerSample,
    Math.min(capture.samples.length, capture.triggerSample + windowSamples),
  );
  if (primaryRms <= 1e-12 || searchStart + windowSamples >= capture.samples.length) return 0;

  let previous = rms(
    capture.samples,
    Math.max(capture.triggerSample, searchStart - windowSamples),
    searchStart,
  );
  let maximumRise = 0;
  for (let start = searchStart; start + windowSamples <= capture.samples.length; start += windowSamples) {
    const current = rms(capture.samples, start, start + windowSamples);
    maximumRise = Math.max(maximumRise, current - previous);
    previous = current;
  }
  return Math.max(0, maximumRise / primaryRms);
}

function unitInterval(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function assessCaptureQuality(
  capture: AudioCapture,
  config: CaptureQualityConfig = DEFAULT_CAPTURE_QUALITY_CONFIG,
): CaptureQualityResult {
  if (!(capture.sampleRate > 0) || !Number.isFinite(capture.sampleRate)) {
    throw new RangeError("Capture sample rate must be finite and positive");
  }
  if (capture.triggerSample < 0 || capture.triggerSample >= capture.samples.length) {
    throw new RangeError("Capture trigger sample lies outside the captured signal");
  }

  let clippedCount = 0;
  let peakAmplitude = 0;
  for (const sample of capture.samples) {
    const absolute = Math.abs(sample);
    peakAmplitude = Math.max(peakAmplitude, absolute);
    if (absolute >= config.clippingAmplitude) clippedCount += 1;
  }
  const clippedFraction = clippedCount / capture.samples.length;

  const noiseStart = capture.triggerSample + offsetSamples(config.noiseWindowStartMs, capture.sampleRate);
  const noiseEnd = capture.triggerSample + offsetSamples(config.noiseWindowEndMs, capture.sampleRate);
  const signalStart = capture.triggerSample + offsetSamples(config.signalWindowStartMs, capture.sampleRate);
  const signalEnd = capture.triggerSample + offsetSamples(config.signalWindowEndMs, capture.sampleRate);
  const noiseRms = rms(capture.samples, noiseStart, noiseEnd);
  const signalRms = rms(capture.samples, signalStart, signalEnd);
  const snrDb = 20 * Math.log10((signalRms + 1e-12) / (noiseRms + 1e-12));
  const multipleImpactRatio = secondaryTransientRatio(capture, config);

  const snrScore = unitInterval((snrDb - config.minimumSnrDb) / (config.strongSnrDb - config.minimumSnrDb));
  const clippingScore = unitInterval(
    1 - clippedFraction / Math.max(config.maximumClippedFraction, 1e-12),
  );
  const impactScore = unitInterval(
    1 - multipleImpactRatio / config.maximumSecondaryTransientRatio,
  );
  const amplitudeScore = unitInterval(
    peakAmplitude / Math.max(config.minimumPeakAmplitude * 4, 1e-12),
  );
  const quality: CaptureQuality = {
    score: 0.45 * snrScore + 0.2 * clippingScore + 0.2 * impactScore + 0.15 * amplitudeScore,
    snrDb,
    clippedFraction,
    peakAmplitude,
    secondaryTransientRatio: multipleImpactRatio,
  };

  if (peakAmplitude < config.minimumPeakAmplitude) {
    return { ok: false, reason: "TOO_QUIET", quality };
  }
  if (clippedFraction > config.maximumClippedFraction) {
    return { ok: false, reason: "CLIPPED", quality };
  }
  if (snrDb < config.minimumSnrDb) return { ok: false, reason: "LOW_SNR", quality };
  if (multipleImpactRatio > config.maximumSecondaryTransientRatio) {
    return { ok: false, reason: "MULTIPLE_IMPACTS", quality };
  }
  return { ok: true, quality };
}
