import { describe, expect, it } from "vitest";
import { estimateDampedModesPronyResearch } from "../src";

function synthesize(sampleRate: number, durationSeconds: number, modes: readonly { f: number; tau: number; amplitude: number; phase: number }[]): Float64Array {
  const samples = new Float64Array(Math.round(sampleRate * durationSeconds));
  for (let index = 0; index < samples.length; index += 1) {
    const t = index / sampleRate;
    let value = 0;
    for (const mode of modes) value += mode.amplitude * Math.exp(-t / mode.tau) * Math.sin(2 * Math.PI * mode.f * t + mode.phase);
    samples[index] = value;
  }
  return samples;
}

describe("research-only Prony damped-mode estimator", () => {
  it("separates two close damped modes in a deterministic digital twin", () => {
    const sampleRate = 8_000;
    const truth = [
      { f: 440, tau: 1.0, amplitude: 0.8, phase: 0.2 },
      { f: 448, tau: 0.72, amplitude: 0.55, phase: 1.1 },
    ];
    const samples = synthesize(sampleRate, 1.5, truth);
    const result = estimateDampedModesPronyResearch(samples, sampleRate, 2);
    expect(result.evidenceEligible).toBe(false);
    expect(result.modes).toHaveLength(2);
    expect(result.modes[0]!.frequencyHz).toBeCloseTo(440, 0);
    expect(result.modes[1]!.frequencyHz).toBeCloseTo(448, 0);
    expect(result.modes[0]!.decaySeconds).toBeGreaterThan(0.5);
    expect(result.modes[1]!.decaySeconds).toBeGreaterThan(0.4);
    expect(result.residualRms).toBeLessThan(1e-3);
  });

  it("never stamps an AcousticFingerprint algorithm version", () => {
    const samples = synthesize(8_000, 0.5, [{ f: 700, tau: 0.3, amplitude: 1, phase: 0 }]);
    const result = estimateDampedModesPronyResearch(samples, 8_000, 1);
    expect(result.researchEstimatorVersion).toBe("prony-damped-modes-research-1");
    expect(result).not.toHaveProperty("algorithmVersion");
    expect(result.evidenceEligible).toBe(false);
  });

  it("remains a research-only estimator and is not promoted to a fingerprint algorithm version", () => {
    const samples = synthesize(8_000, 0.8, [
      { f: 520, tau: 0.6, amplitude: 1, phase: 0.4 },
      { f: 533, tau: 0.5, amplitude: 0.7, phase: 1.3 },
    ]);
    const result = estimateDampedModesPronyResearch(samples, 8_000, 2);
    expect(result.evidenceEligible).toBe(false);
    expect(JSON.stringify(result)).not.toContain("er-dsp-3");
    expect(result.researchEstimatorVersion).not.toMatch(/^er-dsp-/);
  });
});
