import { describe, expect, it } from "vitest";
import { analyzeImpact } from "@everything-rings/dsp";
import { fingerprintRecurrence } from "../src/recurrence";

interface TwinMode {
  readonly frequencyHz: number;
  readonly decaySeconds: number;
  readonly amplitude: number;
  readonly phase: number;
}

interface DigitalTwin {
  readonly name: string;
  readonly modes: readonly TwinMode[];
}

interface Nuisance {
  readonly gain: number;
  readonly dampingScale: number;
  readonly excitationTilt: number;
  readonly noiseAmplitude: number;
  readonly seed: number;
}

const SAMPLE_RATE = 48_000;
const DURATION_SECONDS = 2.6;

function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function renderTwin(twin: DigitalTwin, nuisance: Nuisance): Float32Array {
  const count = Math.round(SAMPLE_RATE * DURATION_SECONDS);
  const samples = new Float32Array(count);
  const random = prng(nuisance.seed);
  for (let index = 0; index < count; index += 1) {
    const t = index / SAMPLE_RATE;
    let value = 0;
    for (let modeIndex = 0; modeIndex < twin.modes.length; modeIndex += 1) {
      const mode = twin.modes[modeIndex]!;
      const positionWeight = Math.max(0.2, 1 + nuisance.excitationTilt * (modeIndex - (twin.modes.length - 1) / 2));
      value += nuisance.gain
        * mode.amplitude
        * positionWeight
        * Math.exp(-t / (mode.decaySeconds * nuisance.dampingScale))
        * Math.sin(2 * Math.PI * mode.frequencyHz * t + mode.phase);
    }
    value += nuisance.noiseAmplitude * (2 * random() - 1);
    samples[index] = Math.max(-0.9, Math.min(0.9, value));
  }
  return samples;
}

const ordinaryTwin: DigitalTwin = {
  name: "ordinary-resonant",
  modes: [
    { frequencyHz: 437, decaySeconds: 1.5, amplitude: 0.18, phase: 0.1 },
    { frequencyHz: 913, decaySeconds: 1.1, amplitude: 0.13, phase: 0.8 },
    { frequencyHz: 1517, decaySeconds: 0.85, amplitude: 0.10, phase: 1.4 },
    { frequencyHz: 2321, decaySeconds: 0.62, amplitude: 0.07, phase: 2.1 },
    { frequencyHz: 3413, decaySeconds: 0.48, amplitude: 0.05, phase: 2.7 },
  ],
};

const highQDigitalTwin: DigitalTwin = {
  name: "high-q",
  modes: [
    { frequencyHz: 521, decaySeconds: 2.2, amplitude: 0.14, phase: 0.2 },
    { frequencyHz: 1183, decaySeconds: 1.9, amplitude: 0.12, phase: 0.9 },
    { frequencyHz: 1987, decaySeconds: 1.6, amplitude: 0.09, phase: 1.7 },
    { frequencyHz: 2879, decaySeconds: 1.4, amplitude: 0.06, phase: 2.4 },
  ],
};

function analyzeTwin(twin: DigitalTwin, nuisance: Nuisance) {
  return analyzeImpact(renderTwin(twin, nuisance), SAMPLE_RATE);
}

describe("digital-twin acoustic stress validation", () => {
  it("recovers a stable fingerprint across gain, excitation, damping, and noise nuisance", () => {
    const reference = analyzeTwin(ordinaryTwin, {
      gain: 1,
      dampingScale: 1,
      excitationTilt: 0,
      noiseAmplitude: 0.0002,
      seed: 1,
    });
    expect(reference.ok).toBe(true);
    if (!reference.ok) return;

    const nuisances: Nuisance[] = [
      { gain: 0.8, dampingScale: 0.95, excitationTilt: -0.08, noiseAmplitude: 0.0004, seed: 2 },
      { gain: 1.1, dampingScale: 1.05, excitationTilt: 0.08, noiseAmplitude: 0.0006, seed: 3 },
      { gain: 0.9, dampingScale: 1.1, excitationTilt: 0.12, noiseAmplitude: 0.0008, seed: 4 },
      { gain: 1.05, dampingScale: 0.9, excitationTilt: -0.12, noiseAmplitude: 0.0005, seed: 5 },
    ];

    for (const nuisance of nuisances) {
      const candidate = analyzeTwin(ordinaryTwin, nuisance);
      expect(candidate.ok).toBe(true);
      if (!candidate.ok) continue;
      const recurrence = fingerprintRecurrence(reference.fingerprint, candidate.fingerprint);
      expect(recurrence.matchedCount).toBeGreaterThanOrEqual(3);
      expect(recurrence.medianCents).toBeLessThanOrEqual(25);
    }
  });

  it("keeps a distinct digital twin acoustically separated from the ordinary twin", () => {
    const left = analyzeTwin(ordinaryTwin, { gain: 1, dampingScale: 1, excitationTilt: 0, noiseAmplitude: 0.0002, seed: 6 });
    const right = analyzeTwin(highQDigitalTwin, { gain: 1, dampingScale: 1, excitationTilt: 0, noiseAmplitude: 0.0002, seed: 7 });
    expect(left.ok).toBe(true);
    expect(right.ok).toBe(true);
    if (!left.ok || !right.ok) return;
    const recurrence = fingerprintRecurrence(left.fingerprint, right.fingerprint);
    expect(recurrence.medianCents).toBeGreaterThan(50);
  });

  it("turns extreme low-SNR stress into an explicit analysis outcome, never silent corruption", () => {
    const result = analyzeTwin(ordinaryTwin, {
      gain: 0.03,
      dampingScale: 0.7,
      excitationTilt: 0.25,
      noiseAmplitude: 0.03,
      seed: 8,
    });
    if (result.ok) {
      expect(result.fingerprint.modes.length).toBeGreaterThanOrEqual(3);
      expect(result.fingerprint.modes.every((mode) => Number.isFinite(mode.frequencyHz) && mode.frequencyHz > 0)).toBe(true);
    } else {
      expect(["NO_STABLE_RESONANCES", "SIGNAL_TOO_SHORT"]).toContain(result.reason);
    }
  });
});
