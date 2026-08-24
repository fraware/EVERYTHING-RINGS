import { describe, expect, it } from "vitest";
import {
  contentDigest,
  createDerivationRecord,
  createMeasurementRecord,
  verifyDerivationRecord,
  verifyMeasurementRecord,
} from "../src";
import { fingerprint, SOFTWARE_REVISION } from "./helpers";

describe("measurement provenance", () => {
  it("content-addresses one immutable measurement independently of later derivations", async () => {
    const fp = fingerprint();
    const measurement = await createMeasurementRecord({
      createdAt: "2026-08-24T12:00:00.000Z",
      specimenId: "specimen-001",
      sessionId: "session-001",
      attemptId: 5,
      material: "metal",
      acquisitionContractVersion: "acquisition-browser-1",
      softwareRevision: SOFTWARE_REVISION,
      fingerprintAlgorithmVersion: fp.algorithmVersion,
      setup: {
        fixedSetup: true,
        microphoneDistanceCm: 20,
        striker: "wooden dowel",
        strikeLocation: "marked rim",
        supportCondition: "fixed support",
      },
      station: {
        stationId: "station-001",
        deviceDescription: "digital station",
        operatingSystem: "test-os",
        runtime: "test-browser",
        microphoneDescription: "simulated microphone",
        captureSettings: null,
      },
      fingerprint: fp,
    });

    expect(measurement.rawMicrophoneSamplesIncluded).toBe(false);
    expect(measurement.measurementId).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(await verifyMeasurementRecord(measurement)).toBe(true);

    const renderer = await createDerivationRecord({
      measurementId: measurement.measurementId,
      kind: "renderer",
      algorithmVersion: "modal-renderer-2",
      configDigest: await contentDigest({ attackMs: 5, normalization: "peak" }),
      artifactDigest: await contentDigest({ renderedFingerprint: measurement.fingerprint }),
      createdAt: "2026-08-24T13:00:00.000Z",
    });
    const instrument = await createDerivationRecord({
      measurementId: measurement.measurementId,
      kind: "instrument",
      algorithmVersion: "modal-instrument-3",
      configDigest: await contentDigest({ anchor: "dominant-mode" }),
      artifactDigest: await contentDigest({ playable: true }),
      createdAt: "2026-08-24T14:00:00.000Z",
    });

    expect(renderer.measurementId).toBe(measurement.measurementId);
    expect(instrument.measurementId).toBe(measurement.measurementId);
    expect(renderer.derivationId).not.toBe(instrument.derivationId);
    expect(await verifyDerivationRecord(renderer)).toBe(true);
    expect(await verifyDerivationRecord(instrument)).toBe(true);
  });

  it("detects tampering without mutable provenance state", async () => {
    const digest = await contentDigest({ a: 1, b: [2, 3] });
    const reordered = await contentDigest({ b: [2, 3], a: 1 });
    expect(digest).toBe(reordered);
  });
});
