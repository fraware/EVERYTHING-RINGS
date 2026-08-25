import { describe, expect, it } from "vitest";
import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { benchmarkSonicTwinBaseline, compareSonicTwinBaseline } from "../src";

function fingerprint(
  frequencies: readonly number[],
  decayScale = 1,
  amplitudeScale = 1,
): AcousticFingerprintV1 {
  return {
    version: 1,
    algorithmVersion: "er-dsp-2",
    sampleRate: 48_000,
    durationSeconds: 2,
    modes: frequencies.map((frequencyHz, index) => ({
      frequencyHz,
      relativeAmplitude: Math.min(1, amplitudeScale / (index + 1)),
      decaySeconds: decayScale * (0.8 / (index + 1)),
      q: 100,
      confidence: 0.9,
      diagnostics: {
        prominenceDb: 20,
        persistenceSeconds: 0.2,
        frequencyStdCents: 2,
        decayFitScore: 0.95,
        observationCount: 12,
      },
    })),
  };
}

describe("Sonic Twin deterministic baseline", () => {
  const base = fingerprint([440, 880, 1320, 1760]);

  it("matches close repeated measurements without emitting a probability", () => {
    const repeated = fingerprint([441, 882, 1323, 1764], 1.05, 0.95);
    const result = compareSonicTwinBaseline(base, repeated);
    expect(result.decision).toBe("match");
    expect(result.matchedModes).toBeGreaterThanOrEqual(3);
    expect(result.calibratedProbability).toBeNull();
  });

  it("rejects clearly separated hard negatives", () => {
    const other = fingerprint([520, 1040, 1560, 2080]);
    const result = compareSonicTwinBaseline(base, other);
    expect(result.decision).toBe("nonmatch");
    expect(result.calibratedProbability).toBeNull();
  });

  it("abstains in the ambiguous region", () => {
    const ambiguous = fingerprint([455, 910, 1365, 1820], 1.7, 0.3);
    const result = compareSonicTwinBaseline(base, ambiguous);
    expect(result.decision).toBe("abstain");
  });

  it("reports coverage separately from verification error rates", () => {
    const metrics = benchmarkSonicTwinBaseline([
      { samePhysicalSpecimen: true, reference: base, candidate: fingerprint([441, 882, 1323, 1764], 1.02, 0.98) },
      { samePhysicalSpecimen: false, reference: base, candidate: fingerprint([530, 1060, 1590, 2120]) },
      { samePhysicalSpecimen: true, reference: base, candidate: fingerprint([455, 910, 1365, 1820], 1.8, 0.25) },
    ]);
    expect(metrics.pairCount).toBe(3);
    expect(metrics.coveredPairCount).toBe(2);
    expect(metrics.abstainedPairCount).toBe(1);
    expect(metrics.truePositiveRate).toBe(1);
    expect(metrics.falsePositiveRate).toBe(0);
  });
});
