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
  readonly algorithmVersion: "er-dsp-1";
  readonly sampleRate: number;
  readonly durationSeconds: number;
  readonly modes: readonly AcousticMode[];
}
