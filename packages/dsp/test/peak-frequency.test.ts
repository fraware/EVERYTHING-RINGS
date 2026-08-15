import { describe, expect, it } from "vitest";

import { generateModalSignal } from "../../fixtures/src/index";
import { FFTJsBackend } from "../src/fft/fft-js-backend";
import { findMaximumBin } from "../src/peaks/maximum";
import { interpolateQuadraticPeakDb } from "../src/peaks/quadratic";
import {
  computeWindowedMagnitudeSpectrumDb,
  createMagnitudeSpectrumWorkspace,
} from "../src/spectrum/magnitude";
import { hannWindow } from "../src/windows/hann";

const FFT_SIZE = 8192;
const TARGET_FREQUENCY_HZ = 997;

function estimateFrequencyHz(sampleRate: number): number {
  const signal = generateModalSignal({
    sampleRate,
    durationSeconds: FFT_SIZE / sampleRate,
    modes: [{
      frequencyHz: TARGET_FREQUENCY_HZ,
      amplitude: 0.8,
      decaySeconds: 100,
      phaseRadians: 0.37,
    }],
  });
  const fft = new FFTJsBackend(FFT_SIZE);
  const workspace = createMagnitudeSpectrumWorkspace(fft);
  const spectrum = computeWindowedMagnitudeSpectrumDb(signal, hannWindow(FFT_SIZE), fft, workspace);
  const minimumBinIndex = Math.ceil((80 * FFT_SIZE) / sampleRate);
  const maximumBinIndex = Math.floor((12_000 * FFT_SIZE) / sampleRate);
  const maximumBin = findMaximumBin(spectrum, minimumBinIndex, maximumBinIndex);
  return interpolateQuadraticPeakDb(spectrum, maximumBin, sampleRate, FFT_SIZE).frequencyHz;
}

describe("sub-bin peak frequency estimation", () => {
  for (const sampleRate of [44_100, 48_000]) {
    it(`recovers a ${TARGET_FREQUENCY_HZ} Hz sinusoid at ${sampleRate} Hz`, () => {
      expect(Math.abs(estimateFrequencyHz(sampleRate) - TARGET_FREQUENCY_HZ)).toBeLessThan(1);
    });
  }
});
