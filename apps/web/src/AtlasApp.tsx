import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import {
  COLLECTION_MEMBERSHIP_MEANING,
  createChallengeDefinition,
  createCollectionMembership,
  createContributorSurface,
  describeAtlasPublicationPreview,
  type ChallengeDefinitionV1,
  type ContributorSurfaceV1,
} from "@everything-rings/atlas-client";
import {
  contentDigest,
  createAtlasCollection,
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
  type AtlasCollectionV1,
  type ResearchRepositoryStateV1,
} from "@everything-rings/validation";
import { useState } from "react";

const REVISION = "0123456789abcdef0123456789abcdef01234567";
const PUBLICATION_PREVIEW = describeAtlasPublicationPreview();

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

async function buildParticipation(repository: ResearchRepositoryStateV1): Promise<{
  readonly collection: AtlasCollectionV1;
  readonly challenge: ChallengeDefinitionV1;
  readonly contributor: ContributorSurfaceV1;
}> {
  const recordIds = repository.atlas.records.map((record) => record.atlasRecordId);
  const collection = await createAtlasCollection({
    createdAt: "2026-08-24T16:10:00.000Z",
    contributorId: "digital-software",
    title: "Synthetic kitchen inclusion set",
    description: "Membership means included in this collection, not the same physical object.",
    atlasRecordIds: recordIds,
  });
  const challenge = await createChallengeDefinition({
    challengeVersion: "synthetic-kitchen-1",
    prompt: "Add a local observation to this playful kitchen set. Canonical object identity is not required.",
    startsAt: "2026-08-24T00:00:00.000Z",
    endsAt: "2026-09-24T00:00:00.000Z",
    allowedArtifactTypes: ["public-observation", "atlas-record"],
    consentRules: {
      publicationRequired: true,
      rawAudioAllowed: false,
      canonicalObjectIdentityRequired: false,
      locationConsentRequiredForGeographicAggregation: false,
    },
    rankingCriteria: "count of consented PCM-free observations; identity and material inference are not contest truth",
    resultStatement: {
      intent: "playful",
      statement: "Playful synthetic lab challenge. Results are not scientific physical-identity evidence and are not a Resonance Atlas network.",
    },
    physicalProtocol: null,
  });
  const contributor = createContributorSurface({
    contributorId: "digital-software",
    displayName: "Built-in software qualification",
    publishedObservationIds: recordIds,
    collectionIds: [collection.collectionId],
  });
  return { collection, challenge, contributor };
}

export function AtlasApp() {
  const [repository, setRepository] = useState<ResearchRepositoryStateV1>();
  const [integrity, setIntegrity] = useState<string>("not run");
  const [snapshotId, setSnapshotId] = useState<string>("—");
  const [collectionTitle, setCollectionTitle] = useState<string>("—");
  const [collectionId, setCollectionId] = useState<string>("");
  const [challengePrompt, setChallengePrompt] = useState<string>("—");
  const [contributorNote, setContributorNote] = useState<string>("—");
  const [publicationReady, setPublicationReady] = useState(false);

  async function run(): Promise<void> {
    const next = await buildDemoRepository();
    const report = await verifyResearchRepositoryIntegrity(next);
    const snapshot = await snapshotAtlasRegistry(next.atlas, "2026-08-24T16:00:00.000Z");
    const participation = await buildParticipation(next);
    setRepository(next);
    setIntegrity(report.valid ? `PASS · ${report.measurementCount} measurements · ${report.derivationCount} derivations · ${report.atlasRecordCount} records` : `FAIL · ${report.reasons.join("; ")}`);
    setSnapshotId(snapshot.snapshotId);
    setCollectionTitle(participation.collection.title);
    setCollectionId(participation.collection.collectionId);
    setChallengePrompt(participation.challenge.prompt);
    setContributorNote(participation.contributor.note);
    setPublicationReady(false);
  }

  const records = repository === undefined ? [] : searchAtlas(repository.atlas, {});
  const membership = records[0] === undefined || collectionId.length === 0
    ? undefined
    : createCollectionMembership(collectionId, records[0].atlasRecordId);

  return <main className="shell release-shell">
    <header>
      <p className="eyebrow">EVERYTHING RINGS / RESONANCE ATLAS LAB</p>
      <h1>Content-addressed acoustic provenance</h1>
      <p className="lede">Builds a complete local measurement → derivation → public Atlas graph. This page is a synthetic lab, not a Resonance Atlas network, and not physical-object identity. Collection membership means included in a set, not the same physical object.</p>
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
    <section className="release-detail-grid">
      <article className="release-detail">
        <h3>Local capture first</h3>
        <p>A capture succeeds on this device before any publication is considered. Publish is a separate explicit action. This lab does not contact a public host.</p>
        <button className="secondary" disabled={repository === undefined} onClick={() => setPublicationReady(true)}>PREVIEW PUBLICATION METADATA</button>
      </article>
      <article className="release-detail">
        <h3>What would leave the device</h3>
        {publicationReady
          ? <p>{PUBLICATION_PREVIEW.metadataThatLeavesTheDevice.join("; ")}. Raw audio is excluded by default. Canonical object identity is not required.</p>
          : <p>Publication metadata stays hidden until you preview it. Raw microphone samples stay on device by default.</p>}
      </article>
      <article className="release-detail">
        <h3>Participation (pre-identity)</h3>
        <p>Challenge: {challengePrompt}</p>
        <p>Collection: {collectionTitle}. Meaning: {membership?.meaning ?? COLLECTION_MEMBERSHIP_MEANING}.</p>
        <p>{contributorNote}</p>
      </article>
    </section>
  </main>;
}
