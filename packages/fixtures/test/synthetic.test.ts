import { describe, expect, it } from "vitest";

import { generateModalSignal } from "../src/index";

describe("generateModalSignal", () => {
  it("is deterministic for a fixed seed", () => {
    const options = {
      sampleRate: 48_000,
      durationSeconds: 0.02,
      modes: [{ frequencyHz: 440, amplitude: 0.8, decaySeconds: 1 }],
      noiseAmplitude: 0.01,
      seed: 42,
    } as const;
    expect(generateModalSignal(options)).toEqual(generateModalSignal(options));
  });
});
