import { describe, expect, it } from "vitest";
import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";
import { ModalInstrumentEngine } from "../src/realtime";

function mode(frequencyHz: number, decaySeconds = 0.6, relativeAmplitude = 1): AcousticMode {
  return {
    frequencyHz,
    decaySeconds,
    relativeAmplitude,
    q: Math.PI * frequencyHz * decaySeconds,
    confidence: 1,
    diagnostics: {
      prominenceDb: 30,
      persistenceSeconds: decaySeconds,
      frequencyStdCents: 0,
      decayFitScore: 1,
      observationCount: 32,
    },
  };
}

function fingerprint(modes: readonly AcousticMode[]): AcousticFingerprintV1 {
  return {
    version: 1,
    algorithmVersion: "er-dsp-1",
    sampleRate: 48_000,
    durationSeconds: 1.5,
    modes,
  };
}

function renderBlocks(engine: ModalInstrumentEngine, sampleCount: number, blockSize = 128): Float32Array {
  const result = new Float32Array(sampleCount);
  for (let offset = 0; offset < sampleCount; offset += blockSize) {
    const block = new Float32Array(Math.min(blockSize, sampleCount - offset));
    engine.process(block);
    result.set(block, offset);
  }
  return result;
}

function positiveCrossingFrequency(samples: Float32Array, sampleRate: number, start: number, end: number): number {
  let crossings = 0;
  for (let index = Math.max(1, start); index < Math.min(end, samples.length); index += 1) {
    if ((samples[index - 1] ?? 0) <= 0 && (samples[index] ?? 0) > 0) crossings += 1;
  }
  return crossings * sampleRate / (end - start);
}

function rms(samples: Float32Array, start: number, end: number): number {
  let sum = 0;
  let count = 0;
  for (let index = start; index < Math.min(end, samples.length); index += 1) {
    const value = samples[index] ?? 0;
    sum += value * value;
    count += 1;
  }
  return count === 0 ? 0 : Math.sqrt(sum / count);
}

describe("ModalInstrumentEngine", () => {
  it("renders deterministically across block boundaries", () => {
    const source = fingerprint([mode(440), mode(997, 0.4, 0.4)]);
    const left = new ModalInstrumentEngine(48_000, source);
    const right = new ModalInstrumentEngine(48_000, source);
    left.noteOn(69);
    right.noteOn(69);
    expect(Array.from(renderBlocks(left, 4096, 128))).toEqual(Array.from(renderBlocks(right, 4096, 257)));
  });

  it("maps the anchor to the requested MIDI frequency", () => {
    const engine = new ModalInstrumentEngine(48_000, fingerprint([mode(440, 1)]));
    engine.noteOn(69);
    const rendered = renderBlocks(engine, 28_800);
    const frequency = positiveCrossingFrequency(rendered, 48_000, 2400, 26_400);
    expect(frequency).toBeGreaterThan(438);
    expect(frequency).toBeLessThan(442);
  });

  it("preserves the measured exponential decay", () => {
    const engine = new ModalInstrumentEngine(48_000, fingerprint([mode(1000, 0.5)]));
    engine.noteOn(69);
    const rendered = renderBlocks(engine, 43_200);
    const earlyStart = 4800;
    const lateStart = 28_800;
    const window = 4800;
    const early = rms(rendered, earlyStart, earlyStart + window);
    const late = rms(rendered, lateStart, lateStart + window);
    const estimated = -(lateStart - earlyStart) / 48_000 / Math.log(late / early);
    expect(estimated).toBeGreaterThan(0.47);
    expect(estimated).toBeLessThan(0.53);
  });

  it("enforces the configured voice cap and supports immediate silence", () => {
    const engine = new ModalInstrumentEngine(48_000, fingerprint([mode(440)]), {
      attackSeconds: 0.003,
      amplitudeExponent: 0.8,
      outputPeak: 0.9,
      maximumVoices: 2,
      maximumModesPerVoice: 16,
      nyquistMargin: 0.98,
      silenceThreshold: 1e-4,
      maximumVoiceSeconds: 8,
    });
    engine.noteOn(60);
    engine.noteOn(64);
    engine.noteOn(67);
    expect(engine.activeVoiceCount).toBe(2);
    engine.allNotesOff();
    const block = new Float32Array(128);
    engine.process(block);
    expect(engine.activeVoiceCount).toBe(0);
    expect(block.every((value) => value === 0)).toBe(true);
  });
});
