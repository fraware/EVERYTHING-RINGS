import { describe, expect, it } from "vitest";
import {
  ImpactCaptureEngine,
  assessCaptureQuality,
  type CaptureConfig,
} from "../src";

const integrationConfig: CaptureConfig = {
  warmupMs: 10,
  preTriggerMs: 120,
  postTriggerMs: 2_800,
  minRms: 0.012,
  minPeak: 0.05,
  rmsNoiseMultiplier: 6,
  peakNoiseMultiplier: 4,
  noiseSmoothing: 0.05,
};

describe("capture engine to quality integration", () => {
  it("preserves hard-clipped Float32 PCM and rejects it before analysis", () => {
    const sampleRate = 1_000;
    const engine = new ImpactCaptureEngine(sampleRate, integrationConfig);
    expect(engine.processBlock(new Float32Array(10))).toEqual([{ type: "ARMED" }]);

    const impact = new Float32Array(3_000);
    for (let index = 0; index < impact.length; index += 1) {
      impact[index] = index < 10 ? (index % 2 === 0 ? 1 : -1) : 0.2;
    }

    const events = engine.processBlock(impact);
    const complete = events.find((event) => event.type === "COMPLETE");
    expect(complete?.type).toBe("COMPLETE");
    if (complete?.type !== "COMPLETE") throw new Error("capture did not complete");

    expect(complete.capture.sampleRate).toBe(sampleRate);
    expect(Math.max(...complete.capture.samples)).toBe(1);
    expect(Math.min(...complete.capture.samples)).toBe(-1);

    const assessment = assessCaptureQuality(complete.capture);
    expect(assessment).toMatchObject({ ok: false, reason: "CLIPPED" });
    expect(assessment.quality.clippedFraction).toBeGreaterThan(0.001);
  });
});
