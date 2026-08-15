export const ACOUSTIC_FINGERPRINT_ALGORITHM_VERSIONS = ["er-dsp-1", "er-dsp-2"] as const;
export type AcousticFingerprintAlgorithmVersion =
  (typeof ACOUSTIC_FINGERPRINT_ALGORITHM_VERSIONS)[number];
export const CURRENT_ACOUSTIC_FINGERPRINT_ALGORITHM_VERSION: AcousticFingerprintAlgorithmVersion =
  "er-dsp-2";

export function isAcousticFingerprintAlgorithmVersion(
  value: unknown,
): value is AcousticFingerprintAlgorithmVersion {
  return typeof value === "string"
    && (ACOUSTIC_FINGERPRINT_ALGORITHM_VERSIONS as readonly string[]).includes(value);
}

export interface AcousticModeDiagnostics {
  readonly prominenceDb: number;
  readonly persistenceSeconds: number;
  readonly frequencyStdCents: number;
  readonly decayFitScore: number;
  readonly observationCount: number;
}

export interface AcousticMode {
  readonly frequencyHz: number;
  readonly relativeAmplitude: number;
  readonly decaySeconds: number;
  readonly q: number;
  readonly confidence: number;
  readonly diagnostics: AcousticModeDiagnostics;
}

export interface AcousticFingerprintV1 {
  readonly version: 1;
  readonly algorithmVersion: AcousticFingerprintAlgorithmVersion;
  readonly sampleRate: number;
  readonly durationSeconds: number;
  readonly modes: readonly AcousticMode[];
}
