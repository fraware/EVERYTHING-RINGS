import { describe, it } from "vitest";
import { analyzeImpact } from "../src";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

describe("analysis finite-PCM fuzz boundary", () => {
  it("returns a structured finite result for 40 randomized finite PCM signals", () => {
    const sampleRates = [8000, 11025, 16000, 22050, 32000, 44100, 48000, 88200, 96000] as const;
    for (let seed = 1; seed <= 40; seed += 1) {
      const random = rng(seed + 100000);
      const sampleRate = sampleRates[Math.floor(random() * sampleRates.length)]!;
      const length = 8192 + Math.floor(random() * 4096);
      const samples = new Float32Array(length);
      const frequency = 80 + random() * Math.max(1, sampleRate * 0.35 - 80);
      const decay = 0.05 + random() * 1.5;
      for (let index = 0; index < length; index += 1) {
        const time = index / sampleRate;
        const noise = (random() * 2 - 1) * 0.02;
        const tone = Math.sin(2 * Math.PI * frequency * time) * Math.exp(-time / decay) * (0.05 + random() * 0.4);
        const impulse = index === Math.floor(random() * Math.min(300, length)) ? random() * 0.9 : 0;
        samples[index] = Math.max(-1, Math.min(1, noise + tone + impulse));
      }
      const result = analyzeImpact(samples, sampleRate);
      if (result.ok) {
        if (result.fingerprint.sampleRate !== sampleRate) throw new Error(`seed ${seed}: sample rate changed`);
        if (!Number.isFinite(result.fingerprint.durationSeconds) || !(result.fingerprint.durationSeconds > 0)) {
          throw new Error(`seed ${seed}: invalid duration`);
        }
        for (const mode of result.fingerprint.modes) {
          for (const value of [mode.frequencyHz, mode.relativeAmplitude, mode.decaySeconds, mode.q, mode.confidence]) {
            if (!Number.isFinite(value)) throw new Error(`seed ${seed}: non-finite mode value`);
          }
          if (!(mode.frequencyHz > 0 && mode.frequencyHz < sampleRate / 2)) throw new Error(`seed ${seed}: mode outside Nyquist`);
        }
      } else if (result.reason !== "SIGNAL_TOO_SHORT" && result.reason !== "NO_STABLE_RESONANCES") {
        throw new Error(`seed ${seed}: unexpected failure reason`);
      }
    }
  });

  it("fails closed on invalid sample rates", () => {
    const samples = new Float32Array(8192);
    for (const sampleRate of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      let threw = false;
      try {
        analyzeImpact(samples, sampleRate);
      } catch (error) {
        threw = error instanceof RangeError;
      }
      if (!threw) throw new Error(`invalid sample rate ${sampleRate} did not throw RangeError`);
    }
  });
});
