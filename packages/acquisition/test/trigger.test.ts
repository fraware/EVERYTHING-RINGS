import { describe, expect, it } from "vitest";
import { DEFAULT_CAPTURE_CONFIG } from "../src/config";
import { measureBlock, shouldTrigger } from "../src/trigger";

describe("strike trigger", () => {
  it("reports peak location and requires both RMS and peak thresholds", () => {
    const metrics = measureBlock(Float32Array.from([0, 0.1, -0.8, 0.2]));
    expect(metrics.peak).toBeCloseTo(0.8);
    expect(metrics.peakIndex).toBe(2);
    expect(shouldTrigger(metrics, 0.001, 0.005, DEFAULT_CAPTURE_CONFIG)).toBe(true);
    expect(
      shouldTrigger({ ...metrics, rms: 0.001 }, 0.001, 0.005, DEFAULT_CAPTURE_CONFIG),
    ).toBe(false);
  });
});
