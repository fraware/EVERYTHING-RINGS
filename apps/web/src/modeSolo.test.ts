import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { describe, expect, it } from "vitest";
import { fingerprintForMode } from "./modeSolo";

const fingerprint: AcousticFingerprintV1 = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48_000,
  durationSeconds: 2.8,
  modes: [
    {
      frequencyHz: 440,
      relativeAmplitude: 1,
      decaySeconds: 1.2,
      q: Math.PI * 440 * 1.2,
      confidence: 0.95,
      diagnostics: { prominenceDb: 22, persistenceSeconds: 1.1, frequencyStdCents: 2, decayFitScore: 0.96, observationCount: 30 },
    },
    {
      frequencyHz: 997,
      relativeAmplitude: 0.52,
      decaySeconds: 0.7,
      q: Math.PI * 997 * 0.7,
      confidence: 0.9,
      diagnostics: { prominenceDb: 18, persistenceSeconds: 0.65, frequencyStdCents: 3, decayFitScore: 0.92, observationCount: 24 },
    },
  ],
};

describe("fingerprintForMode", () => {
  it("projects exactly one estimated mode without changing its values or fingerprint provenance", () => {
    const solo = fingerprintForMode(fingerprint, 1);
    expect(solo).toEqual({ ...fingerprint, modes: [fingerprint.modes[1]] });
    expect(solo?.algorithmVersion).toBe("er-dsp-2");
    expect(solo?.sampleRate).toBe(48_000);
    expect(solo?.modes).toHaveLength(1);
  });

  it.each([-1, 2, 1.5, Number.NaN])("rejects invalid mode index %s", (index) => {
    expect(fingerprintForMode(fingerprint, index)).toBeUndefined();
  });

  it("does not mutate the source fingerprint", () => {
    const originalModes = [...fingerprint.modes];
    fingerprintForMode(fingerprint, 0);
    expect(fingerprint.modes).toEqual(originalModes);
  });
});
