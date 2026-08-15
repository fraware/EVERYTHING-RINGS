import { describe, expect, it } from "vitest";
import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";
import { fingerprintRecurrence } from "../src/recurrence";

function mode(frequencyHz: number): AcousticMode {
  return {
    frequencyHz,
    relativeAmplitude: 1,
    decaySeconds: 1,
    q: Math.PI * frequencyHz,
    confidence: 0.9,
    diagnostics: {
      prominenceDb: 20,
      persistenceSeconds: 1,
      frequencyStdCents: 1,
      decayFitScore: 0.95,
      observationCount: 20,
    },
  };
}

function fingerprint(frequencies: readonly number[]): AcousticFingerprintV1 {
  return {
    version: 1,
    algorithmVersion: "er-dsp-1",
    sampleRate: 48_000,
    durationSeconds: 2,
    modes: frequencies.map(mode),
  };
}

describe("fingerprintRecurrence", () => {
  it("matches identical modal sets one-to-one", () => {
    const result = fingerprintRecurrence(fingerprint([440, 880, 1320]), fingerprint([440, 880, 1320]));
    expect(result.medianCents).toBeCloseTo(0, 8);
    expect(result.matchedCount).toBe(3);
    expect(new Set(result.matches.map((match) => match.candidateIndex)).size).toBe(3);
  });

  it("does not reuse one candidate to explain multiple reference modes", () => {
    const result = fingerprintRecurrence(
      fingerprint([1000, 1010]),
      fingerprint([1005]),
      { referenceModeLimit: 8, candidateModeLimit: 16, unmatchedPenaltyCents: 600 },
    );
    expect(result.matchedCount).toBe(1);
    expect(result.unmatchedReferenceCount).toBe(1);
    expect(result.matches.filter((match) => match.candidateIndex === 0)).toHaveLength(1);
  });

  it("chooses the globally lower-cost assignment instead of greedy reuse", () => {
    const result = fingerprintRecurrence(
      fingerprint([1000, 1100]),
      fingerprint([1002, 1098]),
    );
    expect(result.matches[0]?.candidateIndex).toBe(0);
    expect(result.matches[1]?.candidateIndex).toBe(1);
    expect(result.medianCents).toBeLessThan(5);
  });

  it("penalizes missing reference structure explicitly", () => {
    const result = fingerprintRecurrence(fingerprint([440, 880, 1320]), fingerprint([440]));
    expect(result.matchedCount).toBe(1);
    expect(result.unmatchedReferenceCount).toBe(2);
    expect(result.medianCents).toBe(600);
  });
});
