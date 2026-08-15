import { describe, it } from "vitest";
import { fitRobustLine, interpolateQuadraticPeakDb } from "../src";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

describe("DSP stress invariants", () => {
  it("recovers 1000 randomized parabolic spectral peaks", () => {
    for (let seed = 1; seed <= 1000; seed += 1) {
      const random = rng(seed);
      const expectedOffset = random() * 0.98 - 0.49;
      const curvature = 0.25 + random() * 40;
      const peakDb = -80 + random() * 70;
      const sampleRate = 8000 + random() * 184000;
      const fftSize = 2 ** (8 + Math.floor(random() * 7));
      const magnitudeAt = (x: number) => peakDb - curvature * (x - expectedOffset) ** 2;
      const magnitudes = new Float64Array([-200, magnitudeAt(-1), magnitudeAt(0), magnitudeAt(1), -200]);
      const result = interpolateQuadraticPeakDb(magnitudes, 2, sampleRate, fftSize);
      if (Math.abs(result.binOffset - expectedOffset) > 1e-9) throw new Error(`seed ${seed}: peak offset mismatch`);
      if (Math.abs(result.magnitudeDb - peakDb) > 1e-8) throw new Error(`seed ${seed}: magnitude mismatch`);
      if (!(result.frequencyHz > 0) || !Number.isFinite(result.frequencyHz)) throw new Error(`seed ${seed}: invalid frequency`);
    }
  });

  it("recovers 1000 randomized robust lines with a single strong outlier", () => {
    for (let seed = 1; seed <= 1000; seed += 1) {
      const random = rng(seed + 10000);
      const expectedSlope = random() * 8 - 4;
      const expectedIntercept = random() * 20 - 10;
      const count = 24;
      const x = new Float64Array(count);
      const y = new Float64Array(count);
      for (let index = 0; index < count; index += 1) {
        x[index] = index / 4;
        y[index] = expectedIntercept + expectedSlope * x[index]! + (random() - 0.5) * 0.01;
      }
      const outlierIndex = Math.floor(random() * count);
      y[outlierIndex] = y[outlierIndex]! + (random() < 0.5 ? -1 : 1) * (1 + random() * 4);
      const fit = fitRobustLine(x, y);
      if (!Number.isFinite(fit.slope) || !Number.isFinite(fit.intercept) || !Number.isFinite(fit.residualScale)) throw new Error(`seed ${seed}: non-finite robust fit`);
      if (Math.abs(fit.slope - expectedSlope) > 0.02) throw new Error(`seed ${seed}: slope mismatch`);
      if (!(fit.score >= 0 && fit.score <= 1)) throw new Error(`seed ${seed}: fit score outside [0,1]`);
    }
  });
});
