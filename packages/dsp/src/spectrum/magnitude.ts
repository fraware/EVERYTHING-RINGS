import type { FFTBackend } from "../fft/backend";

const MAGNITUDE_EPSILON = 1e-12;

export interface MagnitudeSpectrumWorkspace {
  readonly windowed: Float32Array;
  readonly real: Float64Array;
  readonly imaginary: Float64Array;
  readonly magnitudeDb: Float64Array;
}

export function createMagnitudeSpectrumWorkspace(fftBackend: FFTBackend): MagnitudeSpectrumWorkspace {
  return {
    windowed: new Float32Array(fftBackend.size),
    real: new Float64Array(fftBackend.binCount),
    imaginary: new Float64Array(fftBackend.binCount),
    magnitudeDb: new Float64Array(fftBackend.binCount),
  };
}

export function computeWindowedMagnitudeSpectrumDb(
  samples: Float32Array,
  window: Float32Array,
  fftBackend: FFTBackend,
  workspace: MagnitudeSpectrumWorkspace,
): Float64Array {
  if (samples.length !== fftBackend.size || window.length !== fftBackend.size) {
    throw new RangeError("Samples and window must match the FFT size");
  }

  for (let sampleIndex = 0; sampleIndex < fftBackend.size; sampleIndex += 1) {
    workspace.windowed[sampleIndex] = (samples[sampleIndex] ?? 0) * (window[sampleIndex] ?? 0);
  }

  fftBackend.forwardReal(workspace.windowed, workspace.real, workspace.imaginary);
  for (let binIndex = 0; binIndex < fftBackend.binCount; binIndex += 1) {
    const real = workspace.real[binIndex] ?? 0;
    const imaginary = workspace.imaginary[binIndex] ?? 0;
    workspace.magnitudeDb[binIndex] = 20 * Math.log10(Math.hypot(real, imaginary) + MAGNITUDE_EPSILON);
  }

  return workspace.magnitudeDb;
}
