import { describe, it } from "vitest";
import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { renderAcousticFingerprint } from "../src";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

describe("synthesis stress invariants", () => {
  it("renders 1000 randomized er-dsp-2 fingerprints without non-finite or over-peak output", () => {
    const sampleRates = [8000, 11025, 16000, 22050, 32000, 44100, 48000, 96000] as const;
    for (let seed = 1; seed <= 1000; seed += 1) {
      const random = rng(seed);
      const sampleRate = sampleRates[Math.floor(random() * sampleRates.length)]!;
      const durationSeconds = 0.005 + random() * 0.01;
      const outputPeak = 0.1 + random() * 0.89;
      const fingerprint: AcousticFingerprintV1 = {
        version: 1,
        algorithmVersion: "er-dsp-2",
        sampleRate,
        durationSeconds,
        modes: Array.from({ length: 6 }, (_, index) => ({
          frequencyHz: 40 + random() * sampleRate * 0.7,
          relativeAmplitude: 0.05 + random() * 0.95,
          decaySeconds: 0.02 + random() * 1.5,
          q: 5 + random() * 500,
          confidence: random(),
          diagnostics: { prominenceDb: 8 + random() * 40, persistenceSeconds: 0.08 + random(), frequencyStdCents: random() * 18, decayFitScore: random(), observationCount: 8 + index },
        })),
      };
      const output = renderAcousticFingerprint(fingerprint, sampleRate, {
        attackSeconds: random() * 0.004,
        amplitudeExponent: 0.4 + random() * 1.5,
        outputPeak,
        maximumModes: 16,
        frequencyScale: 0.25 + random() * 4,
        nyquistMargin: 0.9 + random() * 0.09,
        durationSeconds,
      });
      const expectedLength = Math.max(1, Math.round(durationSeconds * sampleRate));
      if (output.length !== expectedLength) throw new Error(`seed ${seed}: output length mismatch`);
      let peak = 0;
      for (const value of output) {
        if (!Number.isFinite(value)) throw new Error(`seed ${seed}: non-finite rendered sample`);
        peak = Math.max(peak, Math.abs(value));
      }
      if (peak > outputPeak + 1e-6) throw new Error(`seed ${seed}: peak ${peak} exceeds ${outputPeak}`);
    }
  });
});
