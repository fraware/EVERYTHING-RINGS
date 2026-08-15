import { describe, expect, it } from "vitest";
import { hannWindow, interpolateQuadraticPeakDb } from "../src";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

describe("1,000-case DSP stress", () => {
  it("preserves Hann symmetry, range, and endpoints", () => {
    for (let seed = 1; seed <= 1000; seed += 1) {
      const random = rng(seed);
      const size = 2 + Math.floor(random() * 8191);
      const window = hannWindow(size);
      expect(window).toHaveLength(size);
      expect(window[0]).toBeCloseTo(0, 7);
      expect(window[size - 1]).toBeCloseTo(0, 7);
      for (let index = 0; index < Math.min(32, Math.ceil(size / 2)); index += 1) {
        const left = window[index] ?? 0;
        const right = window[size - 1 - index] ?? 0;
        expect(Number.isFinite(left)).toBe(true);
        expect(left).toBeGreaterThanOrEqual(0);
        expect(left).toBeLessThanOrEqual(1);
        expect(left).toBeCloseTo(right, 6);
      }
    }
  });

  it("recovers randomized parabolic peak offsets inside the interpolation cell", () => {
    for (let seed = 1; seed <= 1000; seed += 1) {
      const random = rng(seed ^ 0x51a1);
      const offset = random() * 0.98 - 0.49;
      const curvature = 1 + random() * 30;
      const height = -random() * 80;
      const values = new Float64Array(5);
      for (let index = 0; index < values.length; index += 1) {
        const x = index - 2;
        values[index] = height - curvature * (x - offset) ** 2;
      }
      const peak = interpolateQuadraticPeakDb(values, 2, 48000, 8192);
      expect(peak.binOffset).toBeCloseTo(offset, 10);
      expect(peak.binOffset).toBeGreaterThanOrEqual(-0.5);
      expect(peak.binOffset).toBeLessThanOrEqual(0.5);
      expect(Number.isFinite(peak.frequencyHz)).toBe(true);
      expect(Number.isFinite(peak.magnitudeDb)).toBe(true);
    }
  });
});
