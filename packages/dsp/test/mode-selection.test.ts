import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODE_SELECTION_CONFIG,
  selectAcousticModes,
  type AcousticMode,
} from "../src";

function mode(
  frequencyHz: number,
  relativeAmplitude: number,
  confidence = 0.9,
): AcousticMode {
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

describe("acoustic mode measurement floor", () => {
  it("rejects stable high-confidence tracks below -60 dB relative amplitude", () => {
    const selected = selectAcousticModes([
      mode(440, 1),
      mode(997, 0.4),
      mode(2413, 0.2),
      mode(5000, 0.000999, 1),
    ]);

    expect(selected.map((entry) => entry.frequencyHz)).toEqual([440, 997, 2413]);
  });

  it("keeps a mode exactly on the frozen amplitude boundary", () => {
    const selected = selectAcousticModes([
      mode(440, 1),
      mode(997, DEFAULT_MODE_SELECTION_CONFIG.minimumRelativeAmplitude),
    ]);

    expect(selected.some((entry) => entry.frequencyHz === 997)).toBe(true);
  });

  it("still applies confidence and duplicate suppression above the amplitude floor", () => {
    const selected = selectAcousticModes([
      mode(440, 1),
      mode(441, 0.5, 0.7),
      mode(441.5, 0.4, 0.95),
      mode(997, 0.3, 0.54),
    ]);

    expect(selected).toHaveLength(2);
    expect(selected.some((entry) => entry.frequencyHz === 441.5)).toBe(true);
    expect(selected.some((entry) => entry.frequencyHz === 997)).toBe(false);
  });
});
