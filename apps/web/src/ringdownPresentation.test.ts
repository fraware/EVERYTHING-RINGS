import type { AudioCapture } from "@everything-rings/acquisition";
import {
  extractImpactRingdown,
  type AcousticFingerprintV1,
  type AcousticMode,
} from "@everything-rings/dsp";
import { describe, expect, it } from "vitest";
import {
  captureRingdownAuditionSamples,
  modeEnvelopeFractionAtTime,
  modeRelativeEnvelopeAtTime,
  peakMatchSamples,
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

  it("reuses the deterministic DSP ringdown isolation for capture audition", () => {
    const samples = new Float32Array(200);
    samples[80] = 1;
    for (let index = 81; index < samples.length; index += 1) {
      samples[index] = Math.exp(-(index - 80) / 30);
    }
    const capture: AudioCapture = { samples, sampleRate: 1000, triggerSample: 80 };
    const expected = extractImpactRingdown(samples, capture.sampleRate, capture.triggerSample).samples;
    expect(Array.from(captureRingdownAuditionSamples(capture))).toEqual(Array.from(expected));
  });

  it("applies gain-only peak matching for a less confounded consumer A/B", () => {
    const source = Float32Array.from([-0.25, 0.5, -0.125]);
    const matched = peakMatchSamples(source, 0.9);
    expect(matched[0]).toBeCloseTo(-0.45, 6);
    expect(matched[1]).toBeCloseTo(0.9, 6);
    expect(matched[2]).toBeCloseTo(-0.225, 6);
    expect(Array.from(source)).toEqual([-0.25, 0.5, -0.125]);
  });

  it("rejects invalid physical timing and peak inputs", () => {
    expect(() => modeEnvelopeFractionAtTime(0, 1)).toThrow(RangeError);
    expect(() => modeEnvelopeFractionAtTime(1, -1)).toThrow(RangeError);
    expect(() => captureRingdownAuditionSamples({ samples: new Float32Array(8), sampleRate: 48_000, triggerSample: 9 })).toThrow(RangeError);
    expect(() => peakMatchSamples(new Float32Array([1]), 0)).toThrow(RangeError);
  });
});
