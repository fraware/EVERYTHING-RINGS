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
  searchAtlas,
  snapshotAtlasRegistry,
  verifyResearchRepositoryIntegrity,
  type ResearchRepositoryStateV1,
} from "@everything-rings/validation";
import { useState } from "react";

const REVISION = "0123456789abcdef0123456789abcdef01234567";

function fingerprint(base: number): AcousticFingerprintV1 {
  return {
    version: 1,
    algorithmVersion: "er-dsp-2",
    sampleRate: 48_000,
    durationSeconds: 2,
    modes: [1, 2, 3, 4].map((multiplier, index) => ({
      frequencyHz: base * multiplier,
      relativeAmplitude: 1 / (index + 1),
      decaySeconds: 0.9 / (index + 1),
      q: 100,
      confidence: 0.9,
      diagnostics: { prominenceDb: 20, persistenceSeconds: 0.2, frequencyStdCents: 2, decayFitScore: 0.95, observationCount: 12 },
    })),
  };
}

async function buildDemoRepository(): Promise<ResearchRepositoryStateV1> {
  let repository = emptyResearchRepository();
  for (const [index, specimen] of [
    { id: "digital-atlas-bell", label: "Digital Atlas Bell", family: "bell", base: 440 },
    { id: "digital-atlas-plate", label: "Digital Atlas Plate", family: "plate", base: 620 },
  ].entries()) {
    const fp = fingerprint(specimen.base);
    const measurement = await createMeasurementRecord({
      createdAt: `2026-08-24T15:3${index}:00.000Z`,
      specimenId: specimen.id,
      sessionId: `atlas-session-${index + 1}`,
      attemptId: 1,
      material: "other",
      acquisitionContractVersion: "digital-atlas-demo-1",
      softwareRevision: REVISION,
      fingerprintAlgorithmVersion: fp.algorithmVersion,
      setup: { fixedSetup: true, microphoneDistanceCm: 20, striker: "digital impulse", strikeLocation: "digital-A", supportCondition: "digital fixed" },
      station: { stationId: "digital-atlas-station", deviceDescription: "software", operatingSystem: "browser", runtime: "local", microphoneDescription: null, captureSettings: { sampleRate: 48_000, channelCount: 1 } },
      fingerprint: fp,
    });
    repository = await ingestMeasurement(repository, measurement);
    const derivation = await createDerivationRecord({
      measurementId: measurement.measurementId,
      kind: "visualization",
      algorithmVersion: "atlas-demo-visualization-1",
      configDigest: await contentDigest({ visualization: "modal-card" }),
      artifactDigest: await contentDigest({ specimen: specimen.id, modes: fp.modes.map((mode) => mode.frequencyHz) }),
      createdAt: `2026-08-24T15:4${index}:00.000Z`,
    });
    repository = await ingestDerivation(repository, derivation);
    const record = await createAtlasRecord({
      createdAt: `2026-08-24T15:5${index}:00.000Z`,
      contributor: { contributorId: "digital-software", displayName: "Built-in software qualification" },
      specimen: { specimenId: specimen.id, label: specimen.label, objectFamily: specimen.family, material: "other", publicDescription: "Synthetic Atlas record for software qualification" },
      measurements: [{ measurementId: measurement.measurementId, derivationIds: [derivation.derivationId] }],
    });
    repository = await publishRepositoryAtlasRecord(repository, record);
  }
  return repository;
}

export function AtlasApp() {
  const [repository, setRepository] = useState<ResearchRepositoryStateV1>();
  const [integrity, setIntegrity] = useState<string>("not run");
  const [snapshotId, setSnapshotId] = useState<string>("—");

  async function run(): Promise<void> {
    const next = await buildDemoRepository();
    const report = await verifyResearchRepositoryIntegrity(next);
    const snapshot = await snapshotAtlasRegistry(next.atlas, "2026-08-24T16:00:00.000Z");
    setRepository(next);
    setIntegrity(report.valid ? `PASS · ${report.measurementCount} measurements · ${report.derivationCount} derivations · ${report.atlasRecordCount} records` : `FAIL · ${report.reasons.join("; ")}`);
    setSnapshotId(snapshot.snapshotId);
  }

  const records = repository === undefined ? [] : searchAtlas(repository.atlas, {});
  return <main className="shell release-shell">
    <header>
      <p className="eyebrow">EVERYTHING RINGS / RESONANCE ATLAS LAB</p>
      <h1>Content-addressed acoustic provenance</h1>
      <p className="lede">Builds a complete local measurement → derivation → public Atlas graph. The demo is synthetic and contains no microphone PCM.</p>
    </header>
    <section className="release-import"><button onClick={() => { void run(); }}>BUILD LOCAL ATLAS DEMO</button><span className="small">Integrity: {integrity}</span></section>
    <section className="release-status">
      <article className="release-card"><p className="eyebrow">MEASUREMENTS</p><h2>{repository?.measurements.length ?? 0}</h2></article>
      <article className="release-card"><p className="eyebrow">DERIVATIONS</p><h2>{repository?.derivations.length ?? 0}</h2></article>
      <article className="release-card"><p className="eyebrow">ATLAS RECORDS</p><h2>{repository?.atlas.records.length ?? 0}</h2></article>
    </section>
    <section className="release-table-wrap">
      <div className="release-card-head"><div><p className="eyebrow">PUBLIC INDEX</p><h2>Specimens</h2></div></div>
      <div className="release-table" role="table">
        <div className="release-row release-row-head" role="row"><span>specimen</span><span>label</span><span>family</span><span>material</span><span>measurements</span><span>canonical</span><span>PCM</span><span>status</span></div>
        {records.map((record) => <div className="release-row" role="row" key={record.atlasRecordId}><span>{record.specimenId}</span><span>{record.label}</span><span>{record.objectFamily}</span><span>{record.material}</span><span>{record.measurementCount}</span><span>{record.canonicalSpecimenId}</span><span>none</span><span>verified</span></div>)}
      </div>
      <p className="small">Snapshot: {snapshotId}</p>
    </section>
  </main>;
}
