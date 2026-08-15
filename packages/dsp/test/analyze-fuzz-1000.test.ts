import { describe, expect, it } from "vitest";
import { generateModalSignal } from "../../fixtures/src/index";
import { analyzeImpact } from "../src";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function finiteFingerprint(result: ReturnType<typeof analyzeImpact>): boolean {
  if (!result.ok) return true;
  const fingerprint = result.fingerprint;
  return Number.isFinite(fingerprint.sampleRate)
    && fingerprint.sampleRate > 0
    && Number.isFinite(fingerprint.durationSeconds)
    && fingerprint.durationSeconds > 0
    && fingerprint.modes.every((mode) => (
      Number.isFinite(mode.frequencyHz)
      && mode.frequencyHz > 0
      && mode.frequencyHz < fingerprint.sampleRate / 2
      && Number.isFinite(mode.relativeAmplitude)
      && mode.relativeAmplitude >= 0
      && mode.relativeAmplitude <= 1
      && Number.isFinite(mode.decaySeconds)
      && mode.decaySeconds > 0
      && Number.isFinite(mode.q)
      && mode.q > 0
      && Number.isFinite(mode.confidence)
      && mode.confidence >= 0
      && mode.confidence <= 1
      && Number.isFinite(mode.diagnostics.prominenceDb)
      && Number.isFinite(mode.diagnostics.persistenceSeconds)
      && mode.diagnostics.persistenceSeconds > 0
      && Number.isFinite(mode.diagnostics.frequencyStdCents)
      && mode.diagnostics.frequencyStdCents >= 0
      && Number.isFinite(mode.diagnostics.decayFitScore)
      && mode.diagnostics.decayFitScore >= 0
      && mode.diagnostics.decayFitScore <= 1
      && Number.isInteger(mode.diagnostics.observationCount)
      && mode.diagnostics.observationCount > 0
    ));
}

const shard = Number(process.env.STRESS_SHARD ?? 0);
const casesPerShard = 50;
const firstCase = shard * casesPerShard;
const sampleRates = [22_050, 32_000, 44_100, 48_000, 96_000] as const;

describe(`analyzeImpact fuzz shard ${shard}`, () => {
  it("is deterministic and finite for 50 randomized modal strikes", () => {
    for (let local = 0; local < casesPerShard; local += 1) {
      const caseId = firstCase + local;
      const random = rng(caseId ^ 0x45524655);
      const sampleRate = sampleRates[Math.floor(random() * sampleRates.length)] ?? 48_000;
      const durationSeconds = 0.75 + random() * 0.85;
      const modeCount = 3 + Math.floor(random() * 4);
      const maximumFrequency = Math.min(8_000, sampleRate * 0.42);
      const modes = Array.from({ length: modeCount }, (_, index) => {
        const fraction = (index + 1 + random() * 0.6) / (modeCount + 1);
        return {
          frequencyHz: 90 + fraction * (maximumFrequency - 90),
          amplitude: index === 0 ? 1 : 0.15 + random() * 0.7,
          decaySeconds: 0.15 + random() * 1.35,
          phaseRadians: random() * Math.PI * 2,
        };
      });
      const samples = generateModalSignal({
        sampleRate,
        durationSeconds,
        modes,
        noiseAmplitude: random() * 0.003,
        seed: caseId ^ 0x9917,
      });
      const first = analyzeImpact(samples, sampleRate);
      const second = analyzeImpact(samples, sampleRate);
      expect(second, `determinism failure in case ${caseId}`).toEqual(first);
      expect(finiteFingerprint(first), `non-finite/invalid result in case ${caseId}`).toBe(true);
      if (!first.ok) {
        expect(["SIGNAL_TOO_SHORT", "NO_STABLE_RESONANCES"]).toContain(first.reason);
      }
    }
  }, 120_000);
});
