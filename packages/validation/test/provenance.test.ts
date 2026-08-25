import { describe, expect, it } from "vitest";
import {
  contentDigest,
  createDerivationRecord,
  createDerivationRecordV2,
  createMeasurementRecord,
  DERIVATION_RECORD_V2_TEST_VECTOR,
  verifyDerivationRecord,
  verifyDerivationRecordV2,
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

  it("pins V1 derivation content addressing so V2 cannot change it retroactively", async () => {
    const record = await createDerivationRecord({
      measurementId: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      kind: "renderer",
      algorithmVersion: "modal-renderer-2",
      configDigest: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      artifactDigest: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      createdAt: "2026-08-25T00:00:00.000Z",
    });
    expect(record.derivationContractVersion).toBe("derivation-record-1");
    expect(record.schemaVersion).toBe(1);
    expect(record.derivationId).toBe("sha256:eea977e94ee39fadd02a39259cd4ae1261179c401a2dcc64c281b15e933d97b3");
    expect(await verifyDerivationRecord(record)).toBe(true);
  });
});

describe("derivation record V2", () => {
  it("matches the official test vector and is permutation-invariant over source arrays", async () => {
    const created = await createDerivationRecordV2({ ...DERIVATION_RECORD_V2_TEST_VECTOR.input });
    expect(created.derivationContractVersion).toBe("derivation-record-2");
    expect(created.schemaVersion).toBe(2);
    expect(created.sourceMeasurementIds).toEqual([...DERIVATION_RECORD_V2_TEST_VECTOR.canonicalSourceMeasurementIds]);
    expect(created.derivationId).toBe(DERIVATION_RECORD_V2_TEST_VECTOR.expectedDerivationId);
    expect(await verifyDerivationRecordV2(created)).toBe(true);

    const reversed = await createDerivationRecordV2({
      ...DERIVATION_RECORD_V2_TEST_VECTOR.input,
      sourceMeasurementIds: [...DERIVATION_RECORD_V2_TEST_VECTOR.input.sourceMeasurementIds].reverse(),
    });
    expect(reversed.derivationId).toBe(created.derivationId);
  });

  it("accepts multi-source kinds without overloading V1 kind hashing", async () => {
    const snapshot = await createDerivationRecordV2({
      kind: "snapshot",
      algorithmVersion: "research-benchmark-snapshot-1",
      configDigest: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      sourceMeasurementIds: [],
      sourceDerivationIds: ["sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"],
      sourceDatasetSnapshotIds: [
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      ],
      artifactDigest: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      createdAt: "2026-08-25T00:00:00.000Z",
    });
    expect(snapshot.kind).toBe("snapshot");
    expect(await verifyDerivationRecordV2(snapshot)).toBe(true);
    expect(await verifyDerivationRecordV2({ ...snapshot, sourceDatasetSnapshotIds: [...snapshot.sourceDatasetSnapshotIds].reverse() })).toBe(false);
  });

  it("refuses an object-model with no measurement sources", async () => {
    await expect(createDerivationRecordV2({
      kind: "object-model",
      algorithmVersion: "acoustic-object-model-1",
      configDigest: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      sourceMeasurementIds: [],
      sourceDerivationIds: ["sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"],
      sourceDatasetSnapshotIds: [],
      artifactDigest: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      createdAt: "2026-08-25T00:00:00.000Z",
    })).rejects.toThrow(/sourceMeasurementIds/);
  });
});
