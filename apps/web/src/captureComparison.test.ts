import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";
import { describe, expect, it } from "vitest";
import { mutualNearestFrequencyPairs, summarizeCaptureObservation } from "./captureComparison";

function mode(frequencyHz: number, relativeAmplitude: number, decaySeconds: number): AcousticMode {
  return {
    frequencyHz,
    relativeAmplitude,
    decaySeconds,
    q: Math.PI * frequencyHz * decaySeconds,
    confidence: 0.9,
    diagnostics: {
      prominenceDb: 18,
      persistenceSeconds: decaySeconds * 0.8,
      frequencyStdCents: 3,
      decayFitScore: 0.9,
      observationCount: 12,
    },
  };
}

function fingerprint(modes: readonly AcousticMode[]): AcousticFingerprintV1 {
  return {
    version: 1,
    algorithmVersion: "er-dsp-2",
    sampleRate: 48_000,
    durationSeconds: 2,
    modes,
  };
}

describe("capture comparison", () => {
  it("summarizes deterministic observable properties without an aggregate score", () => {
    const summary = summarizeCaptureObservation(fingerprint([
      mode(1200, 0.4, 0.8),
      mode(300, 1, 0.25),
      mode(2400, 0.2, 1.4),
    ]));

    expect(summary).toEqual({
      modeCount: 3,
      lowestFrequencyHz: 300,
      highestFrequencyHz: 2400,
      strongestFrequencyHz: 300,
      longestDecaySeconds: 1.4,
    });
    expect(Object.keys(summary)).not.toContain("similarity");
  });

  it("pairs only reciprocal nearest frequencies and remains one-to-one", () => {
    const left = fingerprint([mode(440, 1, 1), mode(1000, 0.6, 0.5), mode(3000, 0.2, 0.2)]);
    const right = fingerprint([mode(445, 1, 0.9), mode(1030, 0.5, 0.55), mode(1700, 0.3, 0.4)]);

    const pairs = mutualNearestFrequencyPairs(left, right);
    expect(pairs.map((pair) => [pair.leftModeIndex, pair.rightModeIndex])).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
    expect(new Set(pairs.map((pair) => pair.leftModeIndex)).size).toBe(pairs.length);
    expect(new Set(pairs.map((pair) => pair.rightModeIndex)).size).toBe(pairs.length);
  });

  it("is symmetric when the observations are swapped", () => {
    const left = fingerprint([mode(300, 1, 0.8), mode(800, 0.7, 0.5), mode(2100, 0.4, 0.3)]);
    const right = fingerprint([mode(315, 1, 0.7), mode(790, 0.6, 0.6), mode(2500, 0.3, 0.25)]);

    const forward = mutualNearestFrequencyPairs(left, right);
    const reverse = mutualNearestFrequencyPairs(right, left);
    expect(forward.map((pair) => [pair.leftModeIndex, pair.rightModeIndex])).toEqual(
      reverse.map((pair) => [pair.rightModeIndex, pair.leftModeIndex]),
    );
    expect(forward.map((pair) => pair.distanceCents)).toEqual(reverse.map((pair) => pair.distanceCents));
  });

  it("does not hide a distant reciprocal pair behind an undeclared threshold", () => {
    const pairs = mutualNearestFrequencyPairs(
      fingerprint([mode(220, 1, 0.4)]),
      fingerprint([mode(1760, 1, 0.4)]),
    );

    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.distanceCents).toBeCloseTo(3600, 8);
  });

  it("returns no pairs when either observation has no modes", () => {
    expect(mutualNearestFrequencyPairs(fingerprint([]), fingerprint([mode(440, 1, 1)]))).toEqual([]);
    expect(mutualNearestFrequencyPairs(fingerprint([mode(440, 1, 1)]), fingerprint([]))).toEqual([]);
  });
});
