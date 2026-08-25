import { describe, expect, it } from "vitest";
import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import {
  buildSpatialModalSoundField,
  evaluateSpatialHeldOutLocations,
  fingerprintAtSpatialPoint,
  isSpatialPredictedFingerprint,
} from "../src";

function fp(amplitudes: readonly number[]): AcousticFingerprintV1 {
  const frequencies = [440, 880, 1320];
  return {
    version: 1,
    algorithmVersion: "er-dsp-2",
    sampleRate: 48_000,
    durationSeconds: 2,
    modes: frequencies.map((frequencyHz, index) => ({
      frequencyHz: frequencyHz + index * 0.2,
      relativeAmplitude: amplitudes[index] ?? 0.1,
      decaySeconds: 0.8 / (index + 1),
      q: 100,
      confidence: 0.9,
      diagnostics: { prominenceDb: 20, persistenceSeconds: 0.2, frequencyStdCents: 2, decayFitScore: 0.95, observationCount: 12 },
    })),
  };
}

describe("spatial modal sound field", () => {
  it("preserves modal structure while keeping spatial predictions outside measurement evidence", () => {
    const field = buildSpatialModalSoundField([
      { observationId: "left", specimenId: "specimen-field", strikePoint: { x: 0, y: 0, z: 0 }, fingerprint: fp([1, 0.2, 0.1]) },
      { observationId: "right", specimenId: "specimen-field", strikePoint: { x: 1, y: 0, z: 0 }, fingerprint: fp([0.1, 1, 0.4]) },
      { observationId: "top", specimenId: "specimen-field", strikePoint: { x: 0.5, y: 1, z: 0 }, fingerprint: fp([0.3, 0.4, 1]) },
    ]);
    expect(field.modes).toHaveLength(3);
    expect(field.objectModel.observationCount).toBe(3);

    const left = fingerprintAtSpatialPoint(field, { point: { x: 0, y: 0, z: 0 } });
    const right = fingerprintAtSpatialPoint(field, { point: { x: 1, y: 0, z: 0 } });
    const center = fingerprintAtSpatialPoint(field, { point: { x: 0.5, y: 0.4, z: 0 } });
    expect(left.evidenceEligible).toBe(false);
    expect(left.predictionContractVersion).toBe("spatial-predicted-fingerprint-1");
    expect(left.sourceFingerprintAlgorithmVersions).toContain("er-dsp-2");
    expect("algorithmVersion" in left).toBe(false);
    expect(left.modes[0]!.relativeAmplitude).toBe(1);
    expect(right.modes[1]!.relativeAmplitude).toBe(1);
    expect(center.modes.every((mode) => Number.isFinite(mode.relativeAmplitude))).toBe(true);
    expect(center.modes.map((mode) => mode.frequencyHz)).toEqual(left.modes.map((mode) => mode.frequencyHz));
  });

  it("rejects mixed specimen identity in one field", () => {
    expect(() => buildSpatialModalSoundField([
      { observationId: "a", specimenId: "a", strikePoint: { x: 0, y: 0, z: 0 }, fingerprint: fp([1, 1, 1]) },
      { observationId: "b", specimenId: "b", strikePoint: { x: 1, y: 0, z: 0 }, fingerprint: fp([1, 1, 1]) },
    ])).toThrow(/mix specimen IDs/);
  });

  it("evaluates held-out strike locations against predictions without treating predictions as measurements", () => {
    const training = [
      { observationId: "left", specimenId: "specimen-field", strikePoint: { x: 0, y: 0, z: 0 }, fingerprint: fp([1, 0.2, 0.1]) },
      { observationId: "right", specimenId: "specimen-field", strikePoint: { x: 1, y: 0, z: 0 }, fingerprint: fp([0.1, 1, 0.4]) },
      { observationId: "top", specimenId: "specimen-field", strikePoint: { x: 0.5, y: 1, z: 0 }, fingerprint: fp([0.3, 0.4, 1]) },
    ];
    const heldOut = [
      { observationId: "mid", specimenId: "specimen-field", strikePoint: { x: 0.5, y: 0.2, z: 0 }, fingerprint: fp([0.6, 0.7, 0.5]) },
    ];
    const report = evaluateSpatialHeldOutLocations(training, heldOut);
    expect(report.evaluationVersion).toBe("spatial-held-out-evaluation-1");
    expect(report.evidenceEligible).toBe(false);
    expect(report.releaseGateEquivalent).toBe(false);
    expect("algorithmVersion" in report).toBe(false);
    expect(report.heldOutCount).toBe(1);
    expect(report.modePresencePrecision).not.toBeNull();
    expect(report.modePresenceRecall).not.toBeNull();
    expect(report.frequencyConsistencyMedianCents).not.toBeNull();
    expect(report.relativeAmplitudeErrorDbMedian).not.toBeNull();
    expect(report.interpolationDistanceMedian).toBeGreaterThan(0);
    expect(report.cases).toHaveLength(1);

    const field = buildSpatialModalSoundField(training);
    const predicted = fingerprintAtSpatialPoint(field, { point: { x: 0.5, y: 0.2, z: 0 } });
    expect(isSpatialPredictedFingerprint(predicted)).toBe(true);
    expect(predicted.evidenceEligible).toBe(false);
    expect(() => evaluateSpatialHeldOutLocations(training, [{
      observationId: "forged-prediction",
      specimenId: "specimen-field",
      strikePoint: { x: 0.25, y: 0.25, z: 0 },
      fingerprint: predicted as unknown as AcousticFingerprintV1,
    }])).toThrow(/predicted fingerprint, not a measurement/);
  });
});
