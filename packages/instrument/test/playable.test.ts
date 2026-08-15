import { describe, expect, it } from "vitest";
import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";
import {
  chooseAnchorMode,
  frequencyScaleForMidiNote,
  midiNoteFrequency,
  renderPlayableNote,
} from "../src/playable";

function mode(frequencyHz: number, relativeAmplitude: number, confidence: number): AcousticMode {
  return {
    frequencyHz,
    relativeAmplitude,
    confidence,
    decaySeconds: 0.6,
    q: Math.PI * frequencyHz * 0.6,
    diagnostics: {
      prominenceDb: 24,
      persistenceSeconds: 0.5,
      frequencyStdCents: 1,
      decayFitScore: 0.95,
      observationCount: 30,
    },
  };
}

function fingerprint(modes: readonly AcousticMode[]): AcousticFingerprintV1 {
  return {
    version: 1,
    algorithmVersion: "er-dsp-1",
    sampleRate: 48_000,
    durationSeconds: 0.8,
    modes,
  };
}

describe("playable object mapping", () => {
  it("maps MIDI note 69 to 440 Hz", () => {
    expect(midiNoteFrequency(69)).toBe(440);
    expect(midiNoteFrequency(81)).toBe(880);
  });

  it("chooses the strongest confident resonance inside the anchor band", () => {
    const source = fingerprint([
      mode(95, 0.2, 0.7),
      mode(440, 1, 0.9),
      mode(997, 0.5, 0.8),
      mode(3200, 1, 1),
    ]);
    expect(chooseAnchorMode(source)?.frequencyHz).toBe(440);
  });

  it("preserves modal ratios under chromatic transposition", () => {
    const source = fingerprint([mode(440, 1, 1), mode(880, 0.5, 1)]);
    const scale = frequencyScaleForMidiNote(source, 72);
    expect(scale).toBeCloseTo(midiNoteFrequency(72) / 440, 12);
    expect((880 * scale) / (440 * scale)).toBe(2);
  });

  it("renders a playable note without mutating the fingerprint", () => {
    const source = fingerprint([mode(440, 1, 1), mode(997, 0.4, 0.9)]);
    const original = source.modes.map((candidate) => candidate.frequencyHz);
    const note = renderPlayableNote(source, 60);
    expect(note.samples.some((value) => value !== 0)).toBe(true);
    expect(note.anchorFrequencyHz).toBe(440);
    expect(source.modes.map((candidate) => candidate.frequencyHz)).toEqual(original);
  });
});
