import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";
import { describe, expect, it } from "vitest";
import { createAcousticStoryHtml } from "../src/acoustic-story";

function mode(frequencyHz: number, relativeAmplitude: number, decaySeconds: number): AcousticMode {
  return {
    frequencyHz,
    relativeAmplitude,
    decaySeconds,
    q: Math.PI * frequencyHz * decaySeconds,
    confidence: 0.9,
    diagnostics: {
      prominenceDb: 22,
      persistenceSeconds: 0.5,
      frequencyStdCents: 2,
      decayFitScore: 0.95,
      observationCount: 20,
    },
  };
}

const FINGERPRINT: AcousticFingerprintV1 = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48_000,
  durationSeconds: 1,
  modes: [mode(440, 1, 0.3), mode(997, 0.45, 1.1)],
};

const MODEL = Float32Array.from([0, 0.25, -0.5, 0.75, -0.25, 0]);

describe("Acoustic Story", () => {
  it("creates a deterministic self-contained model-only artifact", () => {
    const first = createAcousticStoryHtml(FINGERPRINT, MODEL, 48_000);
    const second = createAcousticStoryHtml(FINGERPRINT, MODEL, 48_000);
    expect(first).toBe(second);
    expect(first).toContain("<!doctype html>");
    expect(first).toContain("PLAY THIS OBJECT");
    expect(first).toContain("MODEL ONLY · NO RECORDED AUDIO");
    expect(first).toContain("2 RESONANCES");
    expect(first).toContain("440 Hz — 997 Hz");
    expect(first).toContain("er-dsp-2");
    expect(first).toMatch(/erc?1-|er1-/);
    expect(first).toContain('src="data:audio/wav;base64,UklGR');
    expect(first).toContain("Math.exp(-elapsed / decay)");
    expect(first).not.toContain("<script src=");
    expect(first).not.toContain("https://");
    expect(first).not.toContain("http://");
  });

  it("embeds source-mode decay and frequency metadata on the visual rings", () => {
    const html = createAcousticStoryHtml(FINGERPRINT, MODEL, 48_000);
    expect(html).toContain('data-decay="0.3"');
    expect(html).toContain('data-frequency="440"');
    expect(html).toContain('data-decay="1.1"');
    expect(html).toContain('data-frequency="997"');
  });

  it("rejects invalid audio inputs", () => {
    expect(() => createAcousticStoryHtml(FINGERPRINT, MODEL, 0)).toThrow(RangeError);
    expect(() => createAcousticStoryHtml(FINGERPRINT, new Float32Array(0), 48_000)).toThrow(RangeError);
  });
});
