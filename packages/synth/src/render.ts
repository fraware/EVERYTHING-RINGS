import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";

export interface ModalRenderConfig {
  readonly durationSeconds?: number;
  readonly attackSeconds: number;
  readonly amplitudeExponent: number;
  readonly outputPeak: number;
  readonly maximumModes: number;
  readonly frequencyScale: number;
  readonly nyquistMargin: number;
}

export const DEFAULT_MODAL_RENDER_CONFIG: ModalRenderConfig = {
  attackSeconds: 0.003,
  amplitudeExponent: 0.8,
  outputPeak: 0.9,
  maximumModes: 16,
  frequencyScale: 1,
  nyquistMargin: 0.98,
};

function validateConfig(config: ModalRenderConfig): void {
  if (config.durationSeconds !== undefined && (!(config.durationSeconds > 0) || !Number.isFinite(config.durationSeconds))) {
    throw new RangeError("durationSeconds must be finite and positive");
  }
  if (!(config.attackSeconds >= 0) || !Number.isFinite(config.attackSeconds)) {
    throw new RangeError("attackSeconds must be finite and non-negative");
  }
  if (!(config.amplitudeExponent > 0) || !Number.isFinite(config.amplitudeExponent)) {
    throw new RangeError("amplitudeExponent must be finite and positive");
  }
  if (!(config.outputPeak > 0 && config.outputPeak <= 1) || !Number.isFinite(config.outputPeak)) {
    throw new RangeError("outputPeak must be finite and in (0, 1]");
  }
  if (!Number.isInteger(config.maximumModes) || config.maximumModes <= 0) {
    throw new RangeError("maximumModes must be a positive integer");
  }
  if (!(config.frequencyScale > 0) || !Number.isFinite(config.frequencyScale)) {
    throw new RangeError("frequencyScale must be finite and positive");
  }
  if (!(config.nyquistMargin > 0 && config.nyquistMargin < 1) || !Number.isFinite(config.nyquistMargin)) {
    throw new RangeError("nyquistMargin must be finite and in (0, 1)");
  }
}

function attackGain(timeSeconds: number, attackSeconds: number): number {
  if (attackSeconds === 0 || timeSeconds >= attackSeconds) return 1;
  return 0.5 - 0.5 * Math.cos(Math.PI * timeSeconds / attackSeconds);
}

function eligibleModes(
  modes: readonly AcousticMode[],
  sampleRate: number,
  config: ModalRenderConfig,
): readonly AcousticMode[] {
  const maximumFrequency = 0.5 * sampleRate * config.nyquistMargin;
  return modes
    .filter((mode) => mode.frequencyHz * config.frequencyScale < maximumFrequency)
    .filter((mode) => mode.frequencyHz > 0 && mode.decaySeconds > 0 && mode.relativeAmplitude > 0)
    .slice(0, config.maximumModes);
}

export function renderAcousticFingerprint(
  fingerprint: AcousticFingerprintV1,
  sampleRate: number = fingerprint.sampleRate,
  config: ModalRenderConfig = DEFAULT_MODAL_RENDER_CONFIG,
): Float32Array {
  if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) {
    throw new RangeError("sampleRate must be finite and positive");
  }
  validateConfig(config);
  const durationSeconds = config.durationSeconds ?? fingerprint.durationSeconds;
  if (!(durationSeconds > 0) || !Number.isFinite(durationSeconds)) {
    throw new RangeError("render duration must be finite and positive");
  }
  const sampleCount = Math.max(1, Math.round(durationSeconds * sampleRate));
  const output = new Float32Array(sampleCount);
  const modes = eligibleModes(fingerprint.modes, sampleRate, config);

  for (const mode of modes) {
    const frequencyHz = mode.frequencyHz * config.frequencyScale;
    const amplitude = mode.relativeAmplitude ** config.amplitudeExponent;
    const angularFrequency = 2 * Math.PI * frequencyHz;
    for (let index = 0; index < sampleCount; index += 1) {
      const timeSeconds = index / sampleRate;
      const envelope = Math.exp(-timeSeconds / mode.decaySeconds) * attackGain(timeSeconds, config.attackSeconds);
      output[index] = (output[index] ?? 0) + amplitude * envelope * Math.sin(angularFrequency * timeSeconds);
    }
  }

  let peak = 0;
  for (const value of output) peak = Math.max(peak, Math.abs(value));
  if (peak > 0) {
    const scale = config.outputPeak / peak;
    for (let index = 0; index < output.length; index += 1) {
      output[index] = (output[index] ?? 0) * scale;
    }
  }
  return output;
}
