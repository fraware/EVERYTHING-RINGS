import { describe, expect, it } from "vitest";
import { DEFAULT_MODE_SELECTION_CONFIG, selectAcousticModes, type AcousticMode } from "../src";

function mode(frequencyHz: number, relativeAmplitude: number, confidence = 0.9): AcousticMode {
  return {
    frequencyHz,
    relativeAmplitude,
    decaySeconds: 0.5,
    q: Math.PI * frequencyHz * 0.5,
    confidence,
    diagnostics: {
      prominenceDb: 20,
      persistenceSeconds: 0.3,
      frequencyStdCents: 2,
      decayFitScore: 0.95,
      observationCount: 20,
    },
  };
}

describe("modal measurement floor under stress", () => {
  it("rejects 1000 persistent high-confidence tracks below the -60 dB floor", () => {
    const candidates = [mode(440, 1), mode(997, 0.4), mode(2413, 0.2)];
    for (let index = 0; index < 1000; index += 1) {
      const amplitude = DEFAULT_MODE_SELECTION_CONFIG.minimumRelativeAmplitude * (index / 1000);
      candidates.push(mode(3000 + index * 5, amplitude, 1));
    }
    const selected = selectAcousticModes(candidates);
    expect(selected.map((entry) => entry.frequencyHz)).toEqual([440, 997, 2413]);
  });
});
