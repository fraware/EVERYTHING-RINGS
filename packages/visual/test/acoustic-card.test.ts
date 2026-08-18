import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";
import { describe, expect, it } from "vitest";
import { createAcousticCardSvg } from "../src/acoustic-card";
import { fingerprintSignature } from "../src/acoustic-dna";

function mode(frequencyHz: number, amplitude: number, decaySeconds: number): AcousticMode {
  return {
    frequencyHz,
    relativeAmplitude: amplitude,
    decaySeconds,
    q: Math.PI * frequencyHz * decaySeconds,
    confidence: 0.9,
    diagnostics: {
      prominenceDb: 24,
      persistenceSeconds: 0.5,
      frequencyStdCents: 1,
      decayFitScore: 0.95,
      observationCount: 30,
    },
  };
}

const FINGERPRINT: AcousticFingerprintV1 = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48_000,
  durationSeconds: 2,
  modes: [mode(440, 1, 0.8), mode(1320, 0.45, 0.4), mode(2860, 0.2, 1.2)],
};

describe("Acoustic DNA card", () => {
  it("renders a deterministic standalone social card from the measured fingerprint", () => {
    const first = createAcousticCardSvg(FINGERPRINT);
    const second = createAcousticCardSvg(FINGERPRINT);
    expect(first).toBe(second);
    expect(first).toContain('width="1080" height="1350"');
    expect(first).toContain("3 RESONANCES");
    expect(first).toContain("440 Hz — 2.86 kHz");
    expect(first).toContain(fingerprintSignature(FINGERPRINT));
    expect(first).toContain("er-dsp-2");
    expect(first).toContain("Estimated audible resonances from one recorded transient.");
  });

  it("changes when the measured fingerprint changes", () => {
    const changed = { ...FINGERPRINT, modes: [mode(445, 1, 0.8), ...FINGERPRINT.modes.slice(1)] };
    expect(createAcousticCardSvg(changed)).not.toBe(createAcousticCardSvg(FINGERPRINT));
  });
});
