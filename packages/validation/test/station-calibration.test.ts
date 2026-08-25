import { describe, expect, it } from "vitest";
import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { buildAcousticObjectModel } from "@everything-rings/fingerprint";
import {
  createStationCalibrationProtocol,
  createStationQualificationRecord,
  evaluateStationCalibration,
  evaluateVerifiedStationCalibration,
  resolveObservationStationStatus,
  stationQualificationStatusAt,
  verifyStationCalibrationProtocol,
  verifyStationQualificationRecord,
} from "../src";

function fp(frequencies: readonly number[]): AcousticFingerprintV1 {
  return {
    version: 1,
    algorithmVersion: "er-dsp-2",
    sampleRate: 48_000,
    durationSeconds: 2,
    modes: frequencies.map((frequencyHz, index) => ({
      frequencyHz,
      relativeAmplitude: 1 / (index + 1),
      decaySeconds: 0.9 / (index + 1),
      q: 100,
      confidence: 0.9,
      diagnostics: { prominenceDb: 20, persistenceSeconds: 0.2, frequencyStdCents: 2, decayFitScore: 0.95, observationCount: 12 },
    })),
  };
}

async function protocol() {
  const model = buildAcousticObjectModel([
    { observationId: "r1", specimenId: "reference-1", fingerprint: fp([440, 880, 1320]) },
    { observationId: "r2", specimenId: "reference-1", fingerprint: fp([441, 882, 1323]) },
  ]);
  return createStationCalibrationProtocol({
    createdAt: "2026-08-24T15:30:00.000Z",
    referencePopulation: "digital-station-reference-v1",
    referenceSpecimenId: "reference-1",
    referenceObjectModel: model,
    minimumCoverage: 1,
    maximumMedianFrequencyDistanceCents: 35,
    minimumMatchedModes: 3,
  });
}

describe("measurement-station calibration", () => {
  it("passes a digital station observation close to its verified frozen reference object model", async () => {
    const frozen = await protocol();
    expect(await verifyStationCalibrationProtocol(frozen)).toBe(true);
    const verdict = await evaluateVerifiedStationCalibration(frozen, {
      stationId: "station-digital-a",
      createdAt: "2026-08-24T15:31:00.000Z",
      specimenId: "reference-1",
      fingerprint: fp([440.5, 881, 1321.5]),
    });
    expect(verdict.passed).toBe(true);
    expect(verdict.stationStatus).toBe("qualified");
    expect(verdict.comparison.coverage).toBe(1);
  });

  it("fails a digital station observation that drifts outside its frozen contract", async () => {
    const frozen = await protocol();
    const verdict = evaluateStationCalibration(frozen, {
      stationId: "station-digital-b",
      createdAt: "2026-08-24T15:31:00.000Z",
      specimenId: "reference-1",
      fingerprint: fp([500, 1000, 1500]),
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.length).toBeGreaterThan(0);
    expect(verdict.stationStatus).toBe("unqualified");
  });

  it("rejects a protocol mutated after its content address was created", async () => {
    const frozen = await protocol();
    const tampered = { ...frozen, maximumMedianFrequencyDistanceCents: 500 };
    expect(await verifyStationCalibrationProtocol(tampered)).toBe(false);
    await expect(evaluateVerifiedStationCalibration(tampered, {
      stationId: "station-digital-c",
      createdAt: "2026-08-24T15:31:00.000Z",
      specimenId: "reference-1",
      fingerprint: fp([440.5, 881, 1321.5]),
    })).rejects.toThrow(/content verification/);
  });
});

describe("physical station qualification", () => {
  it("preserves unqualified observations with status instead of discarding them", async () => {
    const frozen = await protocol();
    const record = await createStationQualificationRecord({
      protocol: frozen,
      createdAt: "2026-08-25T00:00:00.000Z",
      expiresAt: "2026-09-25T00:00:00.000Z",
      stationId: "physical-ref-station-1",
      deviceDescription: "lab workstation",
      microphoneDescription: "reference condenser",
      operatingSystem: "test-os",
      runtime: "test-browser",
      captureSettings: { sampleRate: 48_000, channelCount: 1, autoGainControl: false },
      setup: { fixedSetup: true, microphoneDistanceCm: 20, striker: "wooden dowel", strikeLocation: "marked rim", supportCondition: "fixed support" },
      setupContractVersion: "station-setup-1",
      observations: [
        {
          observationId: "ref-pass",
          stationId: "physical-ref-station-1",
          createdAt: "2026-08-25T00:01:00.000Z",
          specimenId: "reference-1",
          fingerprint: fp([440.5, 881, 1321.5]),
          measurementId: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        {
          observationId: "ref-fail",
          stationId: "physical-ref-station-1",
          createdAt: "2026-08-25T00:02:00.000Z",
          specimenId: "reference-1",
          fingerprint: fp([500, 1000, 1500]),
          measurementId: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      ],
    });
    expect(record.stationQualificationContractVersion).toBe("station-qualification-1");
    expect(record.scopedQuestion).toBe("reference-object-modal-structure");
    expect(record.calibratesAbsoluteLoudness).toBe(false);
    expect(record.assertsGlobalDeviceEquivalence).toBe(false);
    expect(record.observations).toHaveLength(2);
    expect(record.observations.map((observation) => observation.status)).toEqual(["unqualified", "qualified"]);
    expect(record.verdict).toBe("open");
    expect(await verifyStationQualificationRecord(record)).toBe(true);
    expect(stationQualificationStatusAt(record, "2026-08-26T00:00:00.000Z")).toBe("unqualified");
  });

  it("marks a previously qualified station expired after the protocol window", async () => {
    expect(resolveObservationStationStatus({
      storedStatus: "qualified",
      qualificationExpiresAt: "2026-09-01T00:00:00.000Z",
      at: "2026-09-02T00:00:00.000Z",
    })).toBe("expired");
    expect(resolveObservationStationStatus({
      storedStatus: "unqualified",
      qualificationExpiresAt: "2026-09-01T00:00:00.000Z",
      at: "2026-09-02T00:00:00.000Z",
    })).toBe("unqualified");
    expect(resolveObservationStationStatus({
      storedStatus: undefined,
      qualificationExpiresAt: null,
      at: "2026-09-02T00:00:00.000Z",
    })).toBe("unknown");
  });
});
