import { describe, expect, it } from "vitest";
import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import {
  contentDigest,
  createAtlasRecord,
  createDerivationRecord,
  createMeasurementRecord,
  emptyResearchRepository,
  ingestDerivation,
  ingestMeasurement,
  publishRepositoryAtlasRecord,
  verifyResearchRepositoryIntegrity,
} from "../src";

const fingerprint: AcousticFingerprintV1 = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48_000,
  durationSeconds: 2,
  modes: [440, 880, 1320].map((frequencyHz, index) => ({
    frequencyHz,
    relativeAmplitude: 1 / (index + 1),
    decaySeconds: 0.8 / (index + 1),
    q: 100,
    confidence: 0.9,
    diagnostics: { prominenceDb: 20, persistenceSeconds: 0.2, frequencyStdCents: 2, decayFitScore: 0.95, observationCount: 12 },
  })),
};

async function measurement() {
  return createMeasurementRecord({
    createdAt: "2026-08-24T15:30:00.000Z",
    specimenId: "specimen-repo",
    sessionId: "session-repo",
    attemptId: 1,
    material: "other",
    acquisitionContractVersion: "digital-acquisition-1",
    softwareRevision: "0123456789abcdef0123456789abcdef01234567",
    fingerprintAlgorithmVersion: "er-dsp-2",
    setup: { fixedSetup: true, microphoneDistanceCm: 20, striker: "digital", strikeLocation: "A", supportCondition: "fixed" },
    station: {
      stationId: "digital-station",
      deviceDescription: "software",
      operatingSystem: "ci",
      runtime: "vitest",
      microphoneDescription: null,
      captureSettings: { sampleRate: 48_000, channelCount: 1 },
    },
    fingerprint,
  });
}

describe("research repository integrity", () => {
  it("closes measurement -> derivation -> Atlas provenance before publication", async () => {
    const m = await measurement();
    let repository = await ingestMeasurement(emptyResearchRepository(), m);
    const d = await createDerivationRecord({
      measurementId: m.measurementId,
      kind: "similarity",
      algorithmVersion: "sonic-twin-baseline-1",
      configDigest: await contentDigest({ thresholds: "default" }),
      artifactDigest: await contentDigest({ score: 0.8 }),
      createdAt: "2026-08-24T15:31:00.000Z",
    });
    repository = await ingestDerivation(repository, d);
    const record = await createAtlasRecord({
      createdAt: "2026-08-24T15:32:00.000Z",
      contributor: null,
      specimen: { specimenId: m.specimenId, label: "Digital reference", objectFamily: "reference", material: "other", publicDescription: null },
      measurements: [{ measurementId: m.measurementId, derivationIds: [d.derivationId] }],
    });
    repository = await publishRepositoryAtlasRecord(repository, record);
    const integrity = await verifyResearchRepositoryIntegrity(repository);
    expect(integrity.valid).toBe(true);
    expect(integrity.measurementCount).toBe(1);
    expect(integrity.derivationCount).toBe(1);
    expect(integrity.atlasRecordCount).toBe(1);
    expect(integrity.atlasMergeCount).toBe(0);
  });

  it("rejects derivations before their immutable measurement root exists", async () => {
    const m = await measurement();
    const d = await createDerivationRecord({
      measurementId: m.measurementId,
      kind: "renderer",
      algorithmVersion: "renderer-test",
      configDigest: await contentDigest({ config: 1 }),
      artifactDigest: await contentDigest({ artifact: 1 }),
      createdAt: "2026-08-24T15:31:00.000Z",
    });
    await expect(ingestDerivation(emptyResearchRepository(), d)).rejects.toThrow(/root measurement/);
  });

  it("rejects Atlas publication when a referenced derivation is absent", async () => {
    const m = await measurement();
    const repository = await ingestMeasurement(emptyResearchRepository(), m);
    const missingDerivation = await contentDigest({ missing: true });
    const record = await createAtlasRecord({
      createdAt: "2026-08-24T15:32:00.000Z",
      contributor: null,
      specimen: { specimenId: m.specimenId, label: "Digital reference", objectFamily: "reference", material: "other", publicDescription: null },
      measurements: [{ measurementId: m.measurementId, derivationIds: [missingDerivation] }],
    });
    await expect(publishRepositoryAtlasRecord(repository, record)).rejects.toThrow(/absent/);
  });

  it("detects post-ingest Atlas content tampering during whole-repository verification", async () => {
    const m = await measurement();
    let repository = await ingestMeasurement(emptyResearchRepository(), m);
    const record = await createAtlasRecord({
      createdAt: "2026-08-24T15:32:00.000Z",
      contributor: null,
      specimen: { specimenId: m.specimenId, label: "Original", objectFamily: "reference", material: "other", publicDescription: null },
      measurements: [{ measurementId: m.measurementId, derivationIds: [] }],
    });
    repository = await publishRepositoryAtlasRecord(repository, record);
    const tamperedRecord = { ...record, specimen: { ...record.specimen, label: "Tampered" } };
    const tampered = { ...repository, atlas: { ...repository.atlas, records: [tamperedRecord] } };
    const integrity = await verifyResearchRepositoryIntegrity(tampered);
    expect(integrity.valid).toBe(false);
    expect(integrity.reasons.some((reason) => reason.includes("failed content verification"))).toBe(true);
  });
});
