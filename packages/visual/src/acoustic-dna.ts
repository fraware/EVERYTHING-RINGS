import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";

export interface AcousticDnaConfig {
  readonly minimumFrequencyHz: number;
  readonly maximumFrequencyHz: number;
  readonly decayReferenceSeconds: number;
  readonly maximumModes: number;
}

export const DEFAULT_ACOUSTIC_DNA_CONFIG: AcousticDnaConfig = {
  minimumFrequencyHz: 80,
  maximumFrequencyHz: 12_000,
  decayReferenceSeconds: 3,
  maximumModes: 16,
};

export interface AcousticDnaMode {
  readonly frequencyHz: number;
  readonly radius: number;
  readonly angleRadians: number;
  readonly intensity: number;
  readonly persistence: number;
  readonly relativeAmplitude: number;
  readonly confidence: number;
}

export interface AcousticDna {
  readonly version: 1;
  readonly signature: string;
  readonly modes: readonly AcousticDnaMode[];
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function canonicalMode(mode: AcousticMode): string {
  const frequencyCents = Math.round(1200 * Math.log2(mode.frequencyHz));
  const decayMilliseconds = Math.round(mode.decaySeconds * 1000);
  const amplitudeMilli = Math.round(mode.relativeAmplitude * 1000);
  const confidenceMilli = Math.round(mode.confidence * 1000);
  return `${frequencyCents},${decayMilliseconds},${amplitudeMilli},${confidenceMilli}`;
}

export function fingerprintSignature(fingerprint: AcousticFingerprintV1): string {
  const canonical = [...fingerprint.modes]
    .filter((mode) => mode.frequencyHz > 0 && Number.isFinite(mode.frequencyHz))
    .sort((left, right) => left.frequencyHz - right.frequencyHz)
    .map(canonicalMode)
    .join(";");
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= BigInt(canonical.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return `er1-${hash.toString(16).padStart(16, "0")}`;
}

export function encodeAcousticDna(
  fingerprint: AcousticFingerprintV1,
  config: AcousticDnaConfig = DEFAULT_ACOUSTIC_DNA_CONFIG,
): AcousticDna {
  if (!(config.minimumFrequencyHz > 0) || !(config.maximumFrequencyHz > config.minimumFrequencyHz)) {
    throw new RangeError("Acoustic DNA frequency range is invalid");
  }
  if (!(config.decayReferenceSeconds > 0) || !Number.isFinite(config.decayReferenceSeconds)) {
    throw new RangeError("decayReferenceSeconds must be finite and positive");
  }
  if (!Number.isInteger(config.maximumModes) || config.maximumModes <= 0) {
    throw new RangeError("maximumModes must be a positive integer");
  }

  const logMinimum = Math.log(config.minimumFrequencyHz);
  const logMaximum = Math.log(config.maximumFrequencyHz);
  const modes = [...fingerprint.modes]
    .filter((mode) => mode.frequencyHz > 0 && Number.isFinite(mode.frequencyHz))
    .sort((left, right) => left.frequencyHz - right.frequencyHz)
    .slice(0, config.maximumModes)
    .map((mode): AcousticDnaMode => {
      const logFrequency = Math.log(mode.frequencyHz);
      const radius = clampUnit((logFrequency - logMinimum) / (logMaximum - logMinimum));
      const octavePosition = Math.log2(mode.frequencyHz / 55);
      const pitchClassTurn = ((octavePosition % 1) + 1) % 1;
      return {
        frequencyHz: mode.frequencyHz,
        radius,
        angleRadians: pitchClassTurn * 2 * Math.PI,
        intensity: clampUnit(Math.sqrt(Math.max(0, mode.relativeAmplitude)) * mode.confidence),
        persistence: clampUnit(Math.log1p(mode.decaySeconds) / Math.log1p(config.decayReferenceSeconds)),
        relativeAmplitude: mode.relativeAmplitude,
        confidence: mode.confidence,
      };
    });

  return {
    version: 1,
    signature: fingerprintSignature(fingerprint),
    modes,
  };
}
