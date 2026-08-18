import type { AudioCapture } from "@everything-rings/acquisition";
import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";

export const RINGDOWN_VISIBLE_ENVELOPE_FRACTION = 0.1;
export const CAPTURE_AUDITION_LEAD_SECONDS = 0.025;

export interface RingdownSnapshot {
  readonly elapsedSeconds: number;
  readonly dominantModeIndex: number;
  readonly modesAboveVisibleEnvelope: number;
  readonly envelopeFractions: readonly number[];
}

function assertElapsedSeconds(elapsedSeconds: number): void {
  if (!(elapsedSeconds >= 0) || !Number.isFinite(elapsedSeconds)) {
    throw new RangeError("elapsedSeconds must be finite and non-negative");
  }
}

export function modeEnvelopeFractionAtTime(
  decaySeconds: number,
  elapsedSeconds: number,
): number {
  if (!(decaySeconds > 0) || !Number.isFinite(decaySeconds)) {
    throw new RangeError("decaySeconds must be finite and positive");
  }
  assertElapsedSeconds(elapsedSeconds);
  return Math.exp(-elapsedSeconds / decaySeconds);
}

export function modeRelativeEnvelopeAtTime(
  mode: AcousticMode,
  elapsedSeconds: number,
): number {
  return mode.relativeAmplitude * modeEnvelopeFractionAtTime(mode.decaySeconds, elapsedSeconds);
}

export function summarizeRingdownAtTime(
  fingerprint: AcousticFingerprintV1,
  elapsedSeconds: number,
): RingdownSnapshot | undefined {
  assertElapsedSeconds(elapsedSeconds);
  if (fingerprint.modes.length === 0) return undefined;

  const envelopeFractions = fingerprint.modes.map((mode) => (
    modeEnvelopeFractionAtTime(mode.decaySeconds, elapsedSeconds)
  ));
  let dominantModeIndex = 0;
  let dominantRelativeEnvelope = Number.NEGATIVE_INFINITY;
  let modesAboveVisibleEnvelope = 0;

  fingerprint.modes.forEach((mode, index) => {
    const envelopeFraction = envelopeFractions[index] ?? 0;
    const relativeEnvelope = mode.relativeAmplitude * envelopeFraction;
    if (relativeEnvelope > dominantRelativeEnvelope) {
      dominantRelativeEnvelope = relativeEnvelope;
      dominantModeIndex = index;
    }
    if (envelopeFraction >= RINGDOWN_VISIBLE_ENVELOPE_FRACTION) {
      modesAboveVisibleEnvelope += 1;
    }
  });

  return {
    elapsedSeconds,
    dominantModeIndex,
    modesAboveVisibleEnvelope,
    envelopeFractions,
  };
}

export function captureAuditionSamples(
  capture: AudioCapture,
  leadSeconds: number = CAPTURE_AUDITION_LEAD_SECONDS,
): Float32Array {
  if (!(leadSeconds >= 0) || !Number.isFinite(leadSeconds)) {
    throw new RangeError("leadSeconds must be finite and non-negative");
  }
  if (!(capture.sampleRate > 0) || !Number.isFinite(capture.sampleRate)) {
    throw new RangeError("capture sampleRate must be finite and positive");
  }
  if (!Number.isInteger(capture.triggerSample) || capture.triggerSample < 0 || capture.triggerSample > capture.samples.length) {
    throw new RangeError("capture triggerSample is outside the sample buffer");
  }
  const leadSamples = Math.round(leadSeconds * capture.sampleRate);
  const startSample = Math.max(0, capture.triggerSample - leadSamples);
  return capture.samples.slice(startSample);
}

export function peakMatchSamples(samples: Float32Array, outputPeak: number): Float32Array {
  if (!(outputPeak > 0 && outputPeak <= 1) || !Number.isFinite(outputPeak)) {
    throw new RangeError("outputPeak must be finite and in (0, 1]");
  }
  const output = samples.slice();
  let peak = 0;
  for (const sample of output) peak = Math.max(peak, Math.abs(sample));
  if (peak === 0) return output;
  const scale = outputPeak / peak;
  for (let index = 0; index < output.length; index += 1) {
    output[index] = (output[index] ?? 0) * scale;
  }
  return output;
}
