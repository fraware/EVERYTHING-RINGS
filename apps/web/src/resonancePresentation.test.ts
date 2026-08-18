import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { describe, expect, it } from "vitest";
import {
  formatConfidence,
  formatDecay,
  formatFrequency,
  formatRelativeLevel,
  summarizeResonances,
} from "./resonancePresentation";

const FINGERPRINT: AcousticFingerprintV1 = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48000,
  durationSeconds: 2,
  modes: [
    {
      frequencyHz: 1320,
      relativeAmplitude: 0.4,
      decaySeconds: 0.35,
      q: 120,
      confidence: 0.88,
      diagnostics: { prominenceDb: 18, persistenceSeconds: 0.22, frequencyStdCents: 3.1, decayFitScore: 0.91, observationCount: 12 },
    },
    {
      frequencyHz: 440,
      relativeAmplitude: 1,
      decaySeconds: 0.8,
      q: 240,
      confidence: 0.96,
      diagnostics: { prominenceDb: 26, persistenceSeconds: 0.41, frequencyStdCents: 1.4, decayFitScore: 0.97, observationCount: 20 },
    },
    {
      frequencyHz: 2860,
      relativeAmplitude: 0.2,
      decaySeconds: 1.4,
      q: 510,
      confidence: 0.81,
      diagnostics: { prominenceDb: 14, persistenceSeconds: 0.18, frequencyStdCents: 4.8, decayFitScore: 0.86, observationCount: 9 },
    },
  ],
};

describe("resonance presentation", () => {
  it("formats consumer-facing physical quantities without changing their meaning", () => {
    expect(formatFrequency(440.4)).toBe("440 Hz");
    expect(formatFrequency(1320)).toBe("1.32 kHz");
    expect(formatDecay(0.35)).toBe("350 ms");
    expect(formatDecay(1.4)).toBe("1.40 s");
    expect(formatConfidence(0.956)).toBe("96%");
    expect(formatRelativeLevel(1)).toBe("0.0 dB");
    expect(formatRelativeLevel(0.5)).toBe("-6.0 dB");
  });

  it("summarizes strongest, longest, and frequency-span modes without assuming mode order", () => {
    expect(summarizeResonances(FINGERPRINT)).toEqual({
      strongestModeIndex: 1,
      longestModeIndex: 2,
      lowestFrequencyHz: 440,
      highestFrequencyHz: 2860,
    });
  });

  it("returns no summary for an empty diagnostic fingerprint", () => {
    expect(summarizeResonances({ ...FINGERPRINT, modes: [] })).toBeUndefined();
  });
});
