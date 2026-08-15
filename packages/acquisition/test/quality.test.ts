import { describe, expect, it } from "vitest";
import { assessCaptureQuality } from "../src/quality/assess";
import type { AudioCapture } from "../src/types";

function makeCapture({
  sampleRate = 48_000,
  secondImpact = false,
  noiseAmplitude = 0.0001,
  signalAmplitude = 0.5,
  clipped = false,
}: {
  sampleRate?: number;
  secondImpact?: boolean;
  noiseAmplitude?: number;
  signalAmplitude?: number;
  clipped?: boolean;
} = {}): AudioCapture {
  const triggerSample = Math.round(0.12 * sampleRate);
  const length = triggerSample + Math.round(2.8 * sampleRate);
  const samples = new Float32Array(length);
  for (let index = 0; index < triggerSample; index += 1) {
    samples[index] = noiseAmplitude * Math.sin(index * 1.7);
  }
  for (let index = triggerSample; index < length; index += 1) {
    const t = (index - triggerSample) / sampleRate;
    samples[index] = signalAmplitude * Math.exp(-t / 0.8) * Math.sin(2 * Math.PI * 997 * t);
  }
  if (secondImpact) {
    const start = triggerSample + Math.round(0.4 * sampleRate);
    for (let index = start; index < length; index += 1) {
      const t = (index - start) / sampleRate;
      samples[index] += 0.8 * Math.exp(-t / 0.5) * Math.sin(2 * Math.PI * 1400 * t);
    }
  }
  if (clipped) {
    samples.fill(1, triggerSample, triggerSample + Math.round(0.01 * sampleRate));
  }
  return { samples, sampleRate, triggerSample };
}

describe("assessCaptureQuality", () => {
  it("accepts a clean, high-SNR resonant strike", () => {
    const result = assessCaptureQuality(makeCapture());
    expect(result.ok).toBe(true);
    expect(result.quality.snrDb).toBeGreaterThan(35);
  });

  it("rejects clipping before analysis", () => {
    expect(assessCaptureQuality(makeCapture({ clipped: true }))).toMatchObject({
      ok: false,
      reason: "CLIPPED",
    });
  });

  it("rejects a second strong transient", () => {
    expect(assessCaptureQuality(makeCapture({ secondImpact: true }))).toMatchObject({
      ok: false,
      reason: "MULTIPLE_IMPACTS",
    });
  });

  it("rejects insufficient SNR", () => {
    expect(
      assessCaptureQuality(makeCapture({ noiseAmplitude: 0.2, signalAmplitude: 0.05 })),
    ).toMatchObject({ ok: false, reason: "LOW_SNR" });
  });
});
