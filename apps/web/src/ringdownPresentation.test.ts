import type { AudioCapture } from "@everything-rings/acquisition";
import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";
import { describe, expect, it } from "vitest";
import {
  captureAuditionSamples,
  modeEnvelopeFractionAtTime,
  modeRelativeEnvelopeAtTime,
  summarizeRingdownAtTime,
} from "./ringdownPresentation";

function mode(frequencyHz: number, relativeAmplitude: number, decaySeconds: number): AcousticMode {
  return {
    frequencyHz,
    relativeAmplitude,
    decaySeconds,
    q: Math.PI * frequencyHz * decaySeconds,
    confidence: 0.9,
    diagnostics: {
      prominenceDb: 20,
      persistenceSeconds: 0.4,
      frequencyStdCents: 2,
      decayFitScore: 0.95,
      observationCount: 20,
    },
  };
}

const FINGERPRINT: AcousticFingerprintV1 = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48_000,
  durationSeconds: 2,
  modes: [
    mode(440, 1, 0.2),
    mode(880, 0.5, 1),
    mode(1760, 0.25, 2),
  ],
};

describe("ringdown presentation", () => {
  it("uses the fitted exponential amplitude envelope", () => {
    expect(modeEnvelopeFractionAtTime(1, 0)).toBe(1);
    expect(modeEnvelopeFractionAtTime(1, 1)).toBeCloseTo(Math.E ** -1, 12);
    expect(modeRelativeEnvelopeAtTime(FINGERPRINT.modes[1]!, 1)).toBeCloseTo(0.5 / Math.E, 12);
  });

  it("allows the dominant modeled resonance to change during ringdown", () => {
    const strike = summarizeRingdownAtTime(FINGERPRINT, 0);
    const late = summarizeRingdownAtTime(FINGERPRINT, 1);
    expect(strike?.dominantModeIndex).toBe(0);
    expect(late?.dominantModeIndex).toBe(1);
    expect(late?.modesAboveVisibleEnvelope).toBe(2);
  });

  it("auditions the retained capture with a bounded lead-in before the trigger", () => {
    const samples = Float32Array.from(Array.from({ length: 100 }, (_, index) => index));
    const capture: AudioCapture = { samples, sampleRate: 1000, triggerSample: 50 };
    const audition = captureAuditionSamples(capture, 0.01);
    expect(audition).toHaveLength(60);
    expect(audition[0]).toBe(40);
    expect(audition[10]).toBe(50);
    expect(audition.at(-1)).toBe(99);
  });

  it("rejects invalid physical timing inputs", () => {
    expect(() => modeEnvelopeFractionAtTime(0, 1)).toThrow(RangeError);
    expect(() => modeEnvelopeFractionAtTime(1, -1)).toThrow(RangeError);
    expect(() => captureAuditionSamples({ samples: new Float32Array(8), sampleRate: 48_000, triggerSample: 9 })).toThrow(RangeError);
  });
});
