import { describe, expect, it } from "vitest";
import { analyzeImpact } from "../src/analysis/analyze-impact";
import { extractImpactRingdown, refineImpactOnset } from "../src/preprocess/ringdown";

function capturedModalStrike(sampleRate: number): { samples: Float32Array; coarseOnsetSample: number } {
  const durationSeconds = 2.92;
  const trueOnsetSample = Math.round(0.12 * sampleRate);
  const samples = new Float32Array(Math.round(durationSeconds * sampleRate));
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = 0.0001 * Math.sin(index * 0.73);
  }
  samples[trueOnsetSample] = 0.9;
  const modes = [
    { frequencyHz: 440, amplitude: 0.8, decaySeconds: 1.2 },
    { frequencyHz: 997, amplitude: 0.5, decaySeconds: 0.7 },
    { frequencyHz: 2413, amplitude: 0.3, decaySeconds: 0.38 },
  ];
  for (let index = trueOnsetSample + 1; index < samples.length; index += 1) {
    const t = (index - trueOnsetSample) / sampleRate;
    let value = 0;
    for (const mode of modes) {
      value += mode.amplitude * Math.exp(-t / mode.decaySeconds) * Math.sin(2 * Math.PI * mode.frequencyHz * t);
    }
    samples[index] += 0.25 * value;
  }
  return { samples, coarseOnsetSample: trueOnsetSample + Math.round(0.004 * sampleRate) };
}

describe("impact ringdown preprocessing", () => {
  for (const sampleRate of [44_100, 48_000]) {
    it(`refines onset and removes pre-trigger/collision energy at ${sampleRate} Hz`, () => {
      const fixture = capturedModalStrike(sampleRate);
      const expectedOnset = Math.round(0.12 * sampleRate);
      const refined = refineImpactOnset(fixture.samples, sampleRate, fixture.coarseOnsetSample);
      expect(Math.abs(refined - expectedOnset)).toBeLessThan(Math.round(0.003 * sampleRate));

      const ringdown = extractImpactRingdown(fixture.samples, sampleRate, fixture.coarseOnsetSample);
      expect(ringdown.analysisStartSample).toBeGreaterThan(ringdown.refinedOnsetSample);
      expect(ringdown.samples.length).toBeLessThan(fixture.samples.length);
      const result = analyzeImpact(ringdown.samples, sampleRate);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      for (const target of [440, 997, 2413]) {
        const nearest = [...result.fingerprint.modes].sort(
          (left, right) => Math.abs(left.frequencyHz - target) - Math.abs(right.frequencyHz - target),
        )[0];
        expect(nearest).toBeDefined();
        expect(Math.abs((nearest?.frequencyHz ?? 0) - target)).toBeLessThan(Math.max(3, target * 0.005));
      }
    });
  }
});
