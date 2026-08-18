import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";

export interface ResonanceSummary {
  readonly strongestModeIndex: number;
  readonly longestModeIndex: number;
  readonly lowestFrequencyHz: number;
  readonly highestFrequencyHz: number;
}

export function formatFrequency(frequencyHz: number): string {
  if (frequencyHz >= 1000) return `${(frequencyHz / 1000).toFixed(2)} kHz`;
  return `${Math.round(frequencyHz)} Hz`;
}

export function formatDecay(decaySeconds: number): string {
  if (decaySeconds < 1) return `${Math.round(decaySeconds * 1000)} ms`;
  return `${decaySeconds.toFixed(2)} s`;
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function formatRelativeLevel(relativeAmplitude: number): string {
  if (!(relativeAmplitude > 0)) return "−∞ dB";
  const levelDb = 20 * Math.log10(relativeAmplitude);
  return `${levelDb.toFixed(1)} dB`;
}

export function summarizeResonances(fingerprint: AcousticFingerprintV1): ResonanceSummary | undefined {
  if (fingerprint.modes.length === 0) return undefined;

  let strongestModeIndex = 0;
  let longestModeIndex = 0;
  let lowestFrequencyHz = Number.POSITIVE_INFINITY;
  let highestFrequencyHz = 0;

  fingerprint.modes.forEach((mode, index) => {
    const strongest = fingerprint.modes[strongestModeIndex] as AcousticMode;
    const longest = fingerprint.modes[longestModeIndex] as AcousticMode;
    if (mode.relativeAmplitude > strongest.relativeAmplitude) strongestModeIndex = index;
    if (mode.decaySeconds > longest.decaySeconds) longestModeIndex = index;
    lowestFrequencyHz = Math.min(lowestFrequencyHz, mode.frequencyHz);
    highestFrequencyHz = Math.max(highestFrequencyHz, mode.frequencyHz);
  });

  return { strongestModeIndex, longestModeIndex, lowestFrequencyHz, highestFrequencyHz };
}
