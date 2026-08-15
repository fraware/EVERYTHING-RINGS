import { describe, expect, it } from "vitest";

import { generateModalSignal } from "../../fixtures/src/index";
import { FFTJsBackend } from "../src/fft/fft-js-backend";
import { DEFAULT_PEAK_DETECTION_CONFIG, detectSpectralPeaks } from "../src/peaks/detect";
import { forEachSpectrumFrame } from "../src/stft/frames";

const FFT_SIZE = 8192;
const HOP_SIZE = 512;

function hasPeakNear(peaks: readonly { frequencyHz: number }[], frequencyHz: number, toleranceHz: number): boolean {
  return peaks.some((peak) => Math.abs(peak.frequencyHz - frequencyHz) <= toleranceHz);
}

describe("STFT peak detection", () => {
  it("streams the expected number of frames", () => {
    const sampleRate = 48_000;
    const signal = generateModalSignal({
      sampleRate,
      durationSeconds: 0.5,
      modes: [{ frequencyHz: 997, amplitude: 1, decaySeconds: 2 }],
    });
    const fft = new FFTJsBackend(FFT_SIZE);
    const expectedFrames = 1 + Math.floor((signal.length - FFT_SIZE) / HOP_SIZE);
    let observedFrames = 0;
    const returnedFrames = forEachSpectrumFrame(
      signal,
      sampleRate,
      fft,
      { fftSize: FFT_SIZE, hopSize: HOP_SIZE },
      (frame) => {
        expect(frame.frameIndex).toBe(observedFrames);
        observedFrames += 1;
      },
    );
    expect(returnedFrames).toBe(expectedFrames);
    expect(observedFrames).toBe(expectedFrames);
  });

  for (const sampleRate of [44_100, 48_000]) {
    it(`recovers separated resonances at ${sampleRate} Hz`, () => {
      const signal = generateModalSignal({
        sampleRate,
        durationSeconds: FFT_SIZE / sampleRate,
        modes: [
          { frequencyHz: 997, amplitude: 1, decaySeconds: 10, phaseRadians: 0.2 },
          { frequencyHz: 2413, amplitude: 0.55, decaySeconds: 10, phaseRadians: 1.1 },
        ],
      });
      const fft = new FFTJsBackend(FFT_SIZE);
      let peaks = [] as ReturnType<typeof detectSpectralPeaks>;
      forEachSpectrumFrame(
        signal,
        sampleRate,
        fft,
        { fftSize: FFT_SIZE, hopSize: HOP_SIZE },
        (frame) => {
          peaks = detectSpectralPeaks(frame.magnitudeDb, sampleRate, FFT_SIZE, DEFAULT_PEAK_DETECTION_CONFIG);
        },
      );
      expect(hasPeakNear(peaks, 997, 1)).toBe(true);
      expect(hasPeakNear(peaks, 2413, 1)).toBe(true);
    });
  }

  it("rejects a local maximum below the configured prominence", () => {
    const spectrum = new Float64Array(128).fill(-60);
    spectrum[63] = -59;
    spectrum[64] = -55;
    spectrum[65] = -59;
    const peaks = detectSpectralPeaks(spectrum, 48_000, 256, {
      ...DEFAULT_PEAK_DETECTION_CONFIG,
      minimumFrequencyHz: 0,
      maximumFrequencyHz: 20_000,
      minimumProminenceDb: 8,
    });
    expect(peaks).toHaveLength(0);
  });
});
