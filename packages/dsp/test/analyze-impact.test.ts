import { describe, expect, it } from "vitest";

import { generateModalSignal } from "../../fixtures/src/index";
import { analyzeImpact } from "../src/analysis/analyze-impact";

function nearestMode(
  modes: readonly { frequencyHz: number; decaySeconds: number }[],
  targetFrequencyHz: number,
) {
  return [...modes].sort(
    (left, right) =>
      Math.abs(left.frequencyHz - targetFrequencyHz) - Math.abs(right.frequencyHz - targetFrequencyHz),
  )[0];
}

describe("analyzeImpact", () => {
  for (const sampleRate of [44_100, 48_000]) {
    it(`recovers the canonical three-mode fixture at ${sampleRate} Hz`, () => {
      const expected = [
        { frequencyHz: 440, amplitude: 1, decaySeconds: 1.2 },
        { frequencyHz: 997, amplitude: 0.62, decaySeconds: 0.7 },
        { frequencyHz: 2413, amplitude: 0.35, decaySeconds: 0.38 },
      ] as const;
      const signal = generateModalSignal({
        sampleRate,
        durationSeconds: 2.5,
        modes: expected,
      });
      const result = analyzeImpact(signal, sampleRate);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.fingerprint.version).toBe(1);
      expect(result.fingerprint.algorithmVersion).toBe("er-dsp-1");
      expect(result.fingerprint.modes.length).toBeGreaterThanOrEqual(3);

      for (const target of expected) {
        const recovered = nearestMode(result.fingerprint.modes, target.frequencyHz);
        expect(recovered).toBeDefined();
        expect(Math.abs((recovered?.frequencyHz ?? 0) - target.frequencyHz)).toBeLessThan(
          Math.max(3, 0.005 * target.frequencyHz),
        );
        expect(Math.abs((recovered?.decaySeconds ?? 0) - target.decaySeconds) / target.decaySeconds)
          .toBeLessThan(0.15);
      }
    });
  }

  it("does not manufacture modes from silence", () => {
    expect(analyzeImpact(new Float32Array(48_000), 48_000)).toEqual({
      ok: false,
      reason: "NO_STABLE_RESONANCES",
    });
  });

  it("rejects signals shorter than one analysis window", () => {
    expect(analyzeImpact(new Float32Array(1024), 48_000)).toEqual({
      ok: false,
      reason: "SIGNAL_TOO_SHORT",
    });
  });
});
