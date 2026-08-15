import type { FFTBackend } from "../fft/backend";
import {
  computeWindowedMagnitudeSpectrumDb,
  createMagnitudeSpectrumWorkspace,
} from "../spectrum/magnitude";
import { hannWindow } from "../windows/hann";
import { type STFTConfig, validateSTFTConfig } from "./config";

export interface SpectrumFrameView {
  readonly frameIndex: number;
  readonly startSample: number;
  readonly centerTimeSeconds: number;
  readonly magnitudeDb: Float64Array;
}

export type SpectrumFrameConsumer = (frame: SpectrumFrameView) => void;

export function forEachSpectrumFrame(
  samples: Float32Array,
  sampleRate: number,
  fftBackend: FFTBackend,
  config: STFTConfig,
  consume: SpectrumFrameConsumer,
): number {
  validateSTFTConfig(config);
  if (fftBackend.size !== config.fftSize) {
    throw new RangeError(`FFT backend size ${fftBackend.size} does not match STFT size ${config.fftSize}`);
  }
  if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) {
    throw new RangeError(`Sample rate must be finite and positive; received ${sampleRate}`);
  }
  if (samples.length < config.fftSize) return 0;

  const window = hannWindow(config.fftSize);
  const workspace = createMagnitudeSpectrumWorkspace(fftBackend);
  const frameSamples = new Float32Array(config.fftSize);
  const lastStartSample = samples.length - config.fftSize;
  let frameIndex = 0;

  for (let startSample = 0; startSample <= lastStartSample; startSample += config.hopSize) {
    frameSamples.set(samples.subarray(startSample, startSample + config.fftSize));
    const magnitudeDb = computeWindowedMagnitudeSpectrumDb(frameSamples, window, fftBackend, workspace);
    consume({
      frameIndex,
      startSample,
      centerTimeSeconds: (startSample + config.fftSize / 2) / sampleRate,
      magnitudeDb,
    });
    frameIndex += 1;
  }

  return frameIndex;
}
