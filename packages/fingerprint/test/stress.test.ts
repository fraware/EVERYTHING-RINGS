import { describe, it } from "vitest";
import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { fingerprintRecurrence } from "../src";

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

function fingerprint(frequencies: readonly number[]): AcousticFingerprintV1 {
  return {
    version: 1,
    algorithmVersion: "er-dsp-2",
    sampleRate: 48000,
    durationSeconds: 1,
    modes: frequencies.map((frequencyHz, index) => ({
      frequencyHz,
      relativeAmplitude: 1 / (index + 1),
      decaySeconds: 0.8 / (index + 1),
      q: 100,
      confidence: 0.9,
      diagnostics: { prominenceDb: 20, persistenceSeconds: 0.2, frequencyStdCents: 2, decayFitScore: 0.95, observationCount: 12 },
    })),
  };
}

describe("fingerprint recurrence stress invariants", () => {
  it("recovers 1000 global modal shifts under randomized candidate ordering", () => {
    for (let seed = 1; seed <= 1000; seed += 1) {
      const random = rng(seed);
      const base = 160 + random() * 380;
      const referenceFrequencies = [1, 1.73, 2.91, 4.87].map((ratio) => base * ratio);
      const shiftCents = random() * 160 - 80;
      const scale = 2 ** (shiftCents / 1200);
      const candidateFrequencies = referenceFrequencies.map((frequency) => frequency * scale);
      for (let index = candidateFrequencies.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [candidateFrequencies[index], candidateFrequencies[swapIndex]] = [candidateFrequencies[swapIndex]!, candidateFrequencies[index]!];
      }
      const result = fingerprintRecurrence(fingerprint(referenceFrequencies), fingerprint(candidateFrequencies));
      const expectedDistance = Math.abs(shiftCents);
      if (result.matchedCount !== 4 || result.unmatchedReferenceCount !== 0) throw new Error(`seed ${seed}: recurrence failed one-to-one matching`);
      if (Math.abs(result.medianCents - expectedDistance) > 1e-8) throw new Error(`seed ${seed}: median mismatch`);
      if (Math.abs(result.meanCents - expectedDistance) > 1e-8) throw new Error(`seed ${seed}: mean mismatch`);
      const candidateIndices = result.matches.map((match) => match.candidateIndex);
      if (new Set(candidateIndices).size !== 4) throw new Error(`seed ${seed}: a candidate mode was reused`);
    }
  });
});
