import { describe, expect, it } from "vitest";
import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";
import {
  acousticDnaSourceModeIndices,
  encodeAcousticDna,
  fingerprintSignature,
} from "../src/acoustic-dna";

function mode(frequencyHz: number, amplitude = 1, decaySeconds = 0.6): AcousticMode {
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

function fingerprint(modes: readonly AcousticMode[]): AcousticFingerprintV1 {
  return {
    version: 1,
    algorithmVersion: "er-dsp-1",
    sampleRate: 48_000,
    durationSeconds: 1,
    modes,
  };
}

describe("Acoustic DNA", () => {
  it("produces a stable order-independent signature", () => {
    const left = fingerprint([mode(440), mode(997, 0.5)]);
    const right = fingerprint([mode(997, 0.5), mode(440)]);
    expect(fingerprintSignature(left)).toBe(fingerprintSignature(right));
    expect(fingerprintSignature(left)).toMatch(/^er1-[0-9a-f]{16}$/);
  });

  it("changes the signature when measured structure changes", () => {
    expect(fingerprintSignature(fingerprint([mode(440)]))).not.toBe(
      fingerprintSignature(fingerprint([mode(445)])),
    );
  });

  it("encodes every visual coordinate into bounded normalized ranges", () => {
    const dna = encodeAcousticDna(fingerprint([
      mode(80, 1, 0.1),
      mode(440, 0.5, 0.6),
      mode(12_000, 0.2, 3),
    ]));
    for (const candidate of dna.modes) {
      expect(candidate.radius).toBeGreaterThanOrEqual(0);
      expect(candidate.radius).toBeLessThanOrEqual(1);
      expect(candidate.angleRadians).toBeGreaterThanOrEqual(0);
      expect(candidate.angleRadians).toBeLessThan(2 * Math.PI);
      expect(candidate.intensity).toBeGreaterThanOrEqual(0);
      expect(candidate.intensity).toBeLessThanOrEqual(1);
      expect(candidate.persistence).toBeGreaterThanOrEqual(0);
      expect(candidate.persistence).toBeLessThanOrEqual(1);
    }
  });

  it("exposes the exact source indices used by frequency-sorted visual modes", () => {
    const input = fingerprint([
      mode(1320, 0.5),
      mode(440, 1),
      mode(2860, 0.2),
    ]);
    expect(encodeAcousticDna(input).modes.map((candidate) => candidate.frequencyHz)).toEqual([440, 1320, 2860]);
    expect(acousticDnaSourceModeIndices(input)).toEqual([1, 0, 2]);
  });
});
