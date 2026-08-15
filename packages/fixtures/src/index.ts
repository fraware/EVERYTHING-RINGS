export interface SyntheticMode {
  readonly frequencyHz: number;
  readonly amplitude: number;
  readonly decaySeconds: number;
  readonly phaseRadians?: number;
}

export interface SyntheticModalSignalOptions {
  readonly sampleRate: number;
  readonly durationSeconds: number;
  readonly modes: readonly SyntheticMode[];
  readonly noiseAmplitude?: number;
  readonly seed?: number;
}

function createMulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateModalSignal(options: SyntheticModalSignalOptions): Float32Array {
  const { sampleRate, durationSeconds, modes } = options;
  if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) {
    throw new RangeError(`Sample rate must be finite and positive; received ${sampleRate}`);
  }
  if (!(durationSeconds > 0) || !Number.isFinite(durationSeconds)) {
    throw new RangeError(`Duration must be finite and positive; received ${durationSeconds}`);
  }

  const sampleCount = Math.max(1, Math.round(sampleRate * durationSeconds));
  const output = new Float32Array(sampleCount);
  const random = createMulberry32(options.seed ?? 0x4552);
  const noiseAmplitude = options.noiseAmplitude ?? 0;

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const timeSeconds = sampleIndex / sampleRate;
    let value = noiseAmplitude * (2 * random() - 1);
    for (const mode of modes) {
      if (!(mode.frequencyHz > 0) || !(mode.decaySeconds > 0)) {
        throw new RangeError("Synthetic mode frequencies and decay constants must be positive");
      }
      const envelope = Math.exp(-timeSeconds / mode.decaySeconds);
      const phase = 2 * Math.PI * mode.frequencyHz * timeSeconds + (mode.phaseRadians ?? 0);
      value += mode.amplitude * envelope * Math.sin(phase);
    }
    output[sampleIndex] = value;
  }
  return output;
}
