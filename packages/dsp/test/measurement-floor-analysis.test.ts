import { describe, expect, it } from "vitest";
import { generateModalSignal } from "../../fixtures/src/index";
import {
  DEFAULT_ANALYSIS_CONFIG_V1,
  analyzeImpact,
} from "../src/analysis/analyze-impact";

function nearestMode(
  modes: readonly { frequencyHz: number; relativeAmplitude: number }[],
  targetFrequencyHz: number,
) {
  return [...modes].sort(
    (left, right) => Math.abs(left.frequencyHz - targetFrequencyHz)
      - Math.abs(right.frequencyHz - targetFrequencyHz),
  )[0];
}

describe("analysis measurement floor", () => {
  it("removes a stable resonance below the v2 measurement floor after it has been detected", () => {
    const sampleRate = 48_000;
    const weakFrequencyHz = 6_000;
    const signal = generateModalSignal({
      sampleRate,
      durationSeconds: 2.5,
      modes: [
        { frequencyHz: 440, amplitude: 1, decaySeconds: 1.2 },
        { frequencyHz: 997, amplitude: 0.62, decaySeconds: 0.7 },
        { frequencyHz: 2413, amplitude: 0.35, decaySeconds: 0.38 },
        { frequencyHz: weakFrequencyHz, amplitude: 0.0005, decaySeconds: 0.5 },
      ],
    });

    const diagnostic = analyzeImpact(signal, sampleRate, {
      ...DEFAULT_ANALYSIS_CONFIG_V1,
      selection: {
        ...DEFAULT_ANALYSIS_CONFIG_V1.selection,
        minimumRelativeAmplitude: 0,
      },
    });
    expect(diagnostic.ok).toBe(true);
    if (!diagnostic.ok) return;
    const detectedWeakMode = nearestMode(diagnostic.fingerprint.modes, weakFrequencyHz);
    expect(detectedWeakMode).toBeDefined();
    expect(Math.abs((detectedWeakMode?.frequencyHz ?? 0) - weakFrequencyHz)).toBeLessThan(3);
    expect(detectedWeakMode?.relativeAmplitude).toBeLessThan(0.001);

    const measured = analyzeImpact(signal, sampleRate);
    expect(measured.ok).toBe(true);
    if (!measured.ok) return;
    expect(
      measured.fingerprint.modes.some((mode) => Math.abs(mode.frequencyHz - weakFrequencyHz) < 3),
    ).toBe(false);
  });

  it("retains a well-separated resonance safely above the measurement floor", () => {
    const sampleRate = 48_000;
    const targetFrequencyHz = 6_000;
    const signal = generateModalSignal({
      sampleRate,
      durationSeconds: 2.5,
      modes: [
        { frequencyHz: 440, amplitude: 1, decaySeconds: 1.2 },
        { frequencyHz: 997, amplitude: 0.62, decaySeconds: 0.7 },
        { frequencyHz: 2413, amplitude: 0.35, decaySeconds: 0.38 },
        { frequencyHz: targetFrequencyHz, amplitude: 0.002, decaySeconds: 0.5 },
      ],
    });

    const result = analyzeImpact(signal, sampleRate);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const recovered = nearestMode(result.fingerprint.modes, targetFrequencyHz);
    expect(recovered).toBeDefined();
    expect(Math.abs((recovered?.frequencyHz ?? 0) - targetFrequencyHz)).toBeLessThan(3);
    expect(recovered?.relativeAmplitude).toBeGreaterThanOrEqual(0.001);
  });
});
