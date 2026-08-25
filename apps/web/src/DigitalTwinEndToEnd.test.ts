import { describe, expect, it } from "vitest";
import { assessCaptureQuality, type AudioCapture } from "@everything-rings/acquisition";
import { analyzeImpact, extractImpactRingdown } from "@everything-rings/dsp";
import { compareSonicTwinBaseline } from "@everything-rings/fingerprint";
import { renderPlayableNote } from "@everything-rings/instrument";
import { renderAcousticFingerprint } from "@everything-rings/synth";
import {
  contentDigest,
  createAtlasRecord,
  createDerivationRecord,
  createMeasurementRecord,
  verifyAtlasRecord,
  verifyDerivationRecord,
  verifyMeasurementRecord,
} from "@everything-rings/validation";

const SAMPLE_RATE = 48_000;
const REVISION = "0123456789abcdef0123456789abcdef01234567";

function deterministicNoise(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function digitalTwinCapture(seed = 1): AudioCapture {
  const triggerSample = Math.round(0.15 * SAMPLE_RATE);
  const durationSeconds = 3.0;
  const samples = new Float32Array(Math.round(durationSeconds * SAMPLE_RATE));
  const noise = deterministicNoise(seed);
  const modes = [
    { f: 431, tau: 1.35, a: 0.22, p: 0.2 },
    { f: 907, tau: 1.05, a: 0.15, p: 0.8 },
    { f: 1499, tau: 0.82, a: 0.11, p: 1.4 },
    { f: 2281, tau: 0.65, a: 0.08, p: 2.1 },
    { f: 3359, tau: 0.52, a: 0.05, p: 2.7 },
  ];
  for (let index = 0; index < samples.length; index += 1) {
    const background = 0.00025 * (2 * noise() - 1);
    if (index < triggerSample) {
      samples[index] = background;
      continue;
    }
    const t = (index - triggerSample) / SAMPLE_RATE;
    let value = background;
    for (const mode of modes) value += mode.a * Math.exp(-t / mode.tau) * Math.sin(2 * Math.PI * mode.f * t + mode.p);
    samples[index] = Math.max(-0.92, Math.min(0.92, value));
  }
  return { samples, sampleRate: SAMPLE_RATE, triggerSample };
}

function finiteSignal(samples: Float32Array): boolean {
  return samples.length > 0 && samples.every((value) => Number.isFinite(value));
}

function peakMagnitude(samples: Float32Array): number {
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  return peak;
}

describe("digital-twin full-stack qualification", () => {
  it("exercises acquisition quality, DSP, reconstruction, instrument, provenance, Twin baseline, and Atlas without a physical object", async () => {
    const capture = digitalTwinCapture();
    const quality = assessCaptureQuality(capture);
    expect(quality.ok).toBe(true);

    const ringdown = extractImpactRingdown(capture.samples, capture.sampleRate, capture.triggerSample);
    const analysis = analyzeImpact(ringdown.samples, capture.sampleRate);
    expect(analysis.ok).toBe(true);
    if (!analysis.ok) return;
    expect(analysis.fingerprint.modes.length).toBeGreaterThanOrEqual(3);
    expect(analysis.fingerprint.algorithmVersion).toBe("er-dsp-2");

    const reconstructed = renderAcousticFingerprint(analysis.fingerprint, SAMPLE_RATE);
    expect(finiteSignal(reconstructed)).toBe(true);
    expect(peakMagnitude(reconstructed)).toBeLessThanOrEqual(0.90001);

    const reanalysis = analyzeImpact(reconstructed, SAMPLE_RATE);
    expect(reanalysis.ok).toBe(true);
    if (reanalysis.ok) {
      const reconstructionComparison = compareSonicTwinBaseline(analysis.fingerprint, reanalysis.fingerprint);
      expect(reconstructionComparison.decision).not.toBe("nonmatch");
      expect(reconstructionComparison.calibratedProbability).toBeNull();
    }

    for (const midiNote of [48, 60, 72, 84]) {
      const note = renderPlayableNote(analysis.fingerprint, midiNote, SAMPLE_RATE);
      expect(finiteSignal(note.samples)).toBe(true);
      expect(note.frequencyScale).toBeGreaterThan(0);
      expect(note.targetFrequencyHz).toBeGreaterThan(0);
    }

    const measurement = await createMeasurementRecord({
      createdAt: "2026-08-24T15:00:00.000Z",
      specimenId: "digital-twin-001",
      sessionId: "digital-session-001",
      attemptId: 5,
      material: "other",
      acquisitionContractVersion: "digital-twin-acquisition-1",
      softwareRevision: REVISION,
      fingerprintAlgorithmVersion: analysis.fingerprint.algorithmVersion,
      setup: {
        fixedSetup: true,
        microphoneDistanceCm: 20,
        striker: "digital impulse",
        strikeLocation: "digital coordinate 0",
        supportCondition: "digital fixed boundary",
      },
      station: {
        stationId: "digital-station-001",
        deviceDescription: "deterministic synthetic acoustic twin",
        operatingSystem: "ci",
        runtime: "vitest",
        microphoneDescription: null,
        captureSettings: { sampleRate: SAMPLE_RATE, channelCount: 1 },
      },
      fingerprint: analysis.fingerprint,
    });
    expect(await verifyMeasurementRecord(measurement)).toBe(true);

    const derivation = await createDerivationRecord({
      measurementId: measurement.measurementId,
      kind: "renderer",
      algorithmVersion: "modal-renderer-current",
      configDigest: await contentDigest({ renderer: "default" }),
      artifactDigest: await contentDigest(Array.from(reconstructed.slice(0, 4096))),
      createdAt: "2026-08-24T15:01:00.000Z",
    });
    expect(await verifyDerivationRecord(derivation)).toBe(true);

    const atlas = await createAtlasRecord({
      createdAt: "2026-08-24T15:02:00.000Z",
      contributor: null,
      specimen: {
        specimenId: "digital-twin-001",
        label: "CI digital twin",
        objectFamily: "synthetic-reference",
        material: "unknown",
        publicDescription: "Non-physical qualification artifact",
      },
      measurements: [{ measurementId: measurement.measurementId, derivationIds: [derivation.derivationId] }],
    });
    expect(atlas.rawMicrophoneSamplesIncluded).toBe(false);
    expect(await verifyAtlasRecord(atlas)).toBe(true);
  });
});
