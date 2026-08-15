import { describe, expect, it } from "vitest";
import { ImpactCaptureEngine } from "../src/engine";

const config = {
  warmupMs: 4,
  preTriggerMs: 4,
  postTriggerMs: 6,
  minRms: 0.1,
  minPeak: 0.5,
  rmsNoiseMultiplier: 6,
  peakNoiseMultiplier: 4,
  noiseSmoothing: 0.05,
} as const;

describe("ImpactCaptureEngine", () => {
  it("preserves a fixed pre-trigger window and native sample rate", () => {
    const engine = new ImpactCaptureEngine(1000, config);
    expect(engine.processBlock(Float32Array.from([0.01, 0.01, 0.01, 0.01]))).toEqual([
      { type: "ARMED" },
    ]);

    const triggerEvents = engine.processBlock(Float32Array.from([0.02, 0.03, 1, 0.25]));
    expect(triggerEvents[0]).toEqual({ type: "TRIGGERED", triggerSample: 4 });

    const completion = engine.processBlock(Float32Array.from([0.2, 0.15, 0.1, 0.05]));
    const event = completion.find((candidate) => candidate.type === "COMPLETE");
    expect(event?.type).toBe("COMPLETE");
    if (event?.type !== "COMPLETE") throw new Error("capture did not complete");
    expect(event.capture.sampleRate).toBe(1000);
    expect(event.capture.triggerSample).toBe(4);
    expect(event.capture.samples).toHaveLength(10);
    expect(Array.from(event.capture.samples.slice(2, 7))).toEqual([0.02, 0.03, 1, 0.25, 0.2]);
  });

  it("requires an explicit reset after completion", () => {
    const engine = new ImpactCaptureEngine(1000, { ...config, postTriggerMs: 2 });
    engine.processBlock(Float32Array.from([0, 0, 0, 0]));
    engine.processBlock(Float32Array.from([0, 1, 0, 0]));
    expect(engine.state).toBe("complete");
    expect(engine.processBlock(Float32Array.from([1, 1, 1]))).toEqual([]);
    engine.reset();
    expect(engine.state).toBe("warming");
  });
});
