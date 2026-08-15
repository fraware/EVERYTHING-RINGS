import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAPTURE_QUALITY_CONFIG,
  assessCaptureQuality,
  type AudioCapture,
} from "../src";

function makeBoundaryCapture(): AudioCapture {
  const sampleRate = 1_000;
  const triggerSample = 120;
  const samples = new Float32Array(1_000);
  for (let index = 0; index < triggerSample; index += 1) {
    samples[index] = index % 2 === 0 ? 0.0001 : -0.0001;
  }
  samples.fill(0.2, triggerSample);
  return { samples, sampleRate, triggerSample };
}

function withSamples(...values: number[]): AudioCapture {
  const capture = makeBoundaryCapture();
  values.forEach((value, index) => {
    capture.samples[capture.triggerSample + 10 + index] = value;
  });
  return capture;
}

describe("capture clipping boundaries", () => {
  it("counts the configured clipping amplitude inclusively for both signs", () => {
    const positive = assessCaptureQuality(withSamples(DEFAULT_CAPTURE_QUALITY_CONFIG.clippingAmplitude));
    const negative = assessCaptureQuality(withSamples(-DEFAULT_CAPTURE_QUALITY_CONFIG.clippingAmplitude));

    expect(positive.quality.clippedFraction).toBeCloseTo(0.001, 12);
    expect(negative.quality.clippedFraction).toBeCloseTo(0.001, 12);
  });

  it("accepts exactly the maximum clipped fraction", () => {
    const result = assessCaptureQuality(withSamples(DEFAULT_CAPTURE_QUALITY_CONFIG.clippingAmplitude));
    expect(result.ok).toBe(true);
    expect(result.quality.clippedFraction).toBeCloseTo(
      DEFAULT_CAPTURE_QUALITY_CONFIG.maximumClippedFraction,
      12,
    );
  });

  it("rejects any clipped fraction above the maximum", () => {
    const result = assessCaptureQuality(withSamples(1, -1));
    expect(result).toMatchObject({ ok: false, reason: "CLIPPED" });
    expect(result.quality.clippedFraction).toBeCloseTo(0.002, 12);
  });

  it("does not count Float32 samples immediately below the clipping amplitude", () => {
    const below = Math.fround(DEFAULT_CAPTURE_QUALITY_CONFIG.clippingAmplitude - 1e-4);
    const result = assessCaptureQuality(withSamples(below, -below));
    expect(result.ok).toBe(true);
    expect(result.quality.clippedFraction).toBe(0);
  });
});
