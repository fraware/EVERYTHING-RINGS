import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { describe, expect, it } from "vitest";
import { chooseAnchorMode, midiNoteFrequency, renderPlayableNote } from "../src";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822519) + 3266489917) >>> 0;
    return state / 0x100000000;
  };
}

describe("1,000-case playable-instrument stress", () => {
  it("renders finite bounded notes across randomized fingerprints and MIDI notes", () => {
    const sampleRates = [8000, 16000, 44100, 48000, 96000] as const;
    for (let seed = 0; seed < 1000; seed += 1) {
      const random = rng(seed ^ 0x1a57);
      const sampleRate = sampleRates[Math.floor(random() * sampleRates.length)] ?? 48000;
      const modeCount = 3 + Math.floor(random() * 6);
      const fingerprint: AcousticFingerprintV1 = {
        version: 1,
        algorithmVersion: "er-dsp-1",
        sampleRate,
        durationSeconds: 0.01 + random() * 0.02,
        modes: Array.from({ length: modeCount }, (_, index) => ({
          frequencyHz: 60 + random() * Math.min(6000, sampleRate * 0.45),
          relativeAmplitude: Math.max(0.02, random()),
          decaySeconds: 0.02 + random() * 1.5,
          q: 10 + random() * 1000,
          confidence: 0.2 + random() * 0.8,
          diagnostics: {
            prominenceDb: 8 + random() * 30,
            persistenceSeconds: 0.08 + random(),
            frequencyStdCents: random() * 18,
            decayFitScore: random(),
            observationCount: 8 + index,
          },
        })),
      };
      const anchor = chooseAnchorMode(fingerprint);
      expect(anchor).toBeDefined();
      const midiNote = Math.floor(random() * 128);
      const rendered = renderPlayableNote(fingerprint, midiNote, sampleRate);
      expect(rendered.targetFrequencyHz).toBeCloseTo(midiNoteFrequency(midiNote), 12);
      expect(rendered.frequencyScale).toBeGreaterThan(0);
      expect(rendered.samples.length).toBeGreaterThan(0);
      let peak = 0;
      for (const value of rendered.samples) {
        expect(Number.isFinite(value)).toBe(true);
        peak = Math.max(peak, Math.abs(value));
      }
      expect(peak).toBeLessThanOrEqual(0.900001);
    }
  });
});
