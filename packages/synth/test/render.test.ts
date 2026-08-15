import { describe, expect, it } from "vitest";
import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";
import { renderAcousticFingerprint } from "../src/render";

function mode(frequencyHz: number, decaySeconds: number, relativeAmplitude = 1): AcousticMode {
  return {
    frequencyHz,
    decaySeconds,
    relativeAmplitude,
    q: Math.PI * frequencyHz * decaySeconds,
    confidence: 1,
    diagnostics: {
      prominenceDb: 30,
      persistenceSeconds: decaySeconds,
      frequencyStdCents: 0,
      decayFitScore: 1,
      observationCount: 32,
    },
  };
}

function fingerprint(modes: readonly AcousticMode[], durationSeconds = 1.2): AcousticFingerprintV1 {
  return {
    version: 1,
    algorithmVersion: "er-dsp-1",
    sampleRate: 48_000,
    durationSeconds,
    modes,
  };
}

function rms(samples: Float32Array, start: number, end: number): number {
  let sum = 0;
  let count = 0;
  for (let index = start; index < Math.min(end, samples.length); index += 1) {
    const value = samples[index] ?? 0;
    sum += value * value;
    count += 1;
  }
  return count === 0 ? 0 : Math.sqrt(sum / count);
}

describe("renderAcousticFingerprint", () => {
  it("is deterministic and click-free at onset", () => {
    const source = fingerprint([mode(997, 0.7), mode(2413, 0.38, 0.4)]);
    const left = renderAcousticFingerprint(source);
    const right = renderAcousticFingerprint(source);
    expect(Array.from(left)).toEqual(Array.from(right));
    expect(left[0]).toBe(0);
    expect(Math.abs(left[1] ?? 0)).toBeLessThan(0.01);
  });

  it("preserves a single-mode decay constant after the attack", () => {
    const source = fingerprint([mode(1000, 0.5)], 1.1);
    const rendered = renderAcousticFingerprint(source, 48_000, {
      attackSeconds: 0.003,
      amplitudeExponent: 1,
      outputPeak: 0.9,
      maximumModes: 16,
      frequencyScale: 1,
      nyquistMargin: 0.98,
    });
    const windowSamples = 4800;
    const earlyStart = 4800;
    const lateStart = 28_800;
    const early = rms(rendered, earlyStart, earlyStart + windowSamples);
    const late = rms(rendered, lateStart, lateStart + windowSamples);
    const deltaSeconds = (lateStart - earlyStart) / 48_000;
    const estimatedDecay = -deltaSeconds / Math.log(late / early);
    expect(estimatedDecay).toBeGreaterThan(0.47);
    expect(estimatedDecay).toBeLessThan(0.53);
  });

  it("filters modes above the configured Nyquist margin", () => {
    const source = fingerprint([mode(23_900, 0.3)]);
    const rendered = renderAcousticFingerprint(source, 48_000);
    expect(Math.max(...rendered.map((value) => Math.abs(value)))).toBe(0);
  });

  it("supports deterministic frequency scaling without mutating the fingerprint", () => {
    const source = fingerprint([mode(440, 0.6)]);
    const originalFrequency = source.modes[0]?.frequencyHz;
    const rendered = renderAcousticFingerprint(source, 48_000, {
      attackSeconds: 0.003,
      amplitudeExponent: 0.8,
      outputPeak: 0.9,
      maximumModes: 16,
      frequencyScale: 2,
      nyquistMargin: 0.98,
    });
    expect(rendered.some((value) => value !== 0)).toBe(true);
    expect(source.modes[0]?.frequencyHz).toBe(originalFrequency);
  });
});
