import { describe, expect, it } from "vitest";
import {
  assessDatasetReadiness,
  assertResearchMaterialTruth,
  calibrationGroupId,
  createResearchBenchmarkSnapshot,
  createResearchObservation,
  createSpecimenRegistry,
  createSpecimenRegistryEntry,
  DATASET_READINESS_TARGETS,
  validateResearchSplitPolicy,
  verifyResearchBenchmarkSnapshot,
  verifyResearchObservation,
  verifySpecimenRegistry,
  verifySpecimenRegistryEntry,
} from "../src";

const REVISION = "0123456789abcdef0123456789abcdef01234567";
const MEASUREMENT = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function materialSingle() {
  return { classification: "single" as const, labels: ["metal" as const], source: "inspection" as const };
}

function nuisance(overrides: Partial<{ stationId: string; operatorId: string; dayId: string }> = {}) {
  return {
    contractVersion: "research-nuisance-metadata-1" as const,
    strikeLocation: "rim-A",
    striker: "wooden-dowel",
    support: "foam-pad",
    microphoneDistanceCm: 20,
    roomId: "synth-lab-1",
    stationId: overrides.stationId ?? "synth-station-a",
    operatorId: overrides.operatorId ?? "operator-synth",
    dayId: overrides.dayId ?? "2026-08-20",
    gainProcessing: "agc-off",
    orientation: "upright",
  };
}

describe("physical research corpus schemas", () => {
  it("registers physical specimen identity independently of fingerprints", async () => {
    const entry = await createSpecimenRegistryEntry({
      createdAt: "2026-08-25T00:00:00.000Z",
      specimenId: "synth-bowl-001",
      identity: "custody-tag-synth-bowl-001",
      objectFamily: "bowl",
      material: materialSingle(),
      provenance: { ownership: "research-lab", collectionSite: "noncampaign-shelf", custodyNotes: null },
      displayLabel: "Synthetic brass bowl",
    });
    expect(entry.specimenEntryContractVersion).toBe("specimen-registry-entry-1");
    expect(await verifySpecimenRegistryEntry(entry)).toBe(true);
    expect("fingerprint" in entry).toBe(false);

    const registry = await createSpecimenRegistry({
      createdAt: "2026-08-25T00:00:00.000Z",
      entries: [entry],
    });
    expect(registry.specimenRegistryContractVersion).toBe("specimen-registry-1");
    expect(await verifySpecimenRegistry(registry)).toBe(true);
  });

  it("keeps identity, family, material, provenance, and display label as separate fields", async () => {
    const composite = await createSpecimenRegistryEntry({
      createdAt: "2026-08-25T00:00:00.000Z",
      specimenId: "synth-lamp-001",
      identity: "custody-tag-synth-lamp-001",
      objectFamily: "lamp",
      material: { classification: "composite/unknown", labels: ["composite"], source: "unknown" },
      provenance: { ownership: null, collectionSite: null, custodyNotes: "noncampaign fixture" },
      displayLabel: "Mixed-material lamp",
    });
    expect(composite.identity).not.toBe(composite.displayLabel);
    expect(composite.objectFamily).toBe("lamp");
    expect(composite.material.classification).toBe("composite/unknown");
  });

  it("accepts multi-material ground truth instead of a forced single label", async () => {
    const entry = await createSpecimenRegistryEntry({
      createdAt: "2026-08-25T00:00:00.000Z",
      specimenId: "synth-composite-001",
      identity: "custody-tag-synth-composite-001",
      objectFamily: "sculpture",
      material: { classification: "multi-material", labels: ["metal", "wood"], source: "expert" },
      provenance: { ownership: null, collectionSite: null, custodyNotes: "noncampaign fixture" },
      displayLabel: "Metal-and-wood sculpture",
    });
    expect(entry.material.labels).toEqual(["metal", "wood"]);
    expect(await verifySpecimenRegistryEntry(entry)).toBe(true);
  });

  it("refuses forcing a composite into a single material label", () => {
    expect(() => assertResearchMaterialTruth({
      classification: "single",
      labels: ["composite"],
      source: "inspection",
    })).toThrow(/multi-material or composite\/unknown/);
  });

  it("binds a research observation to specimen, station, nuisance, and measurement identity", async () => {
    const observation = await createResearchObservation({
      observationId: "obs-synth-bowl-001-a",
      createdAt: "2026-08-25T01:00:00.000Z",
      specimenId: "synth-bowl-001",
      objectFamily: "bowl",
      materialTruthSource: "inspection",
      sessionId: "session-synth-1",
      dayId: "2026-08-20",
      operatorId: "operator-synth",
      stationId: "synth-station-a",
      microphoneDescription: "simulated omni",
      captureSettings: { sampleRate: 48_000, channelCount: 1, autoGainControl: false },
      striker: "wooden-dowel",
      support: "foam-pad",
      microphoneDistanceCm: 20,
      strikeLocation: "rim-A",
      roomId: "synth-lab-1",
      algorithmRevision: "er-dsp-2",
      softwareRevision: REVISION,
      acquisitionOutcome: "success",
      measurementId: MEASUREMENT,
      stationStatus: "unknown",
      nuisance: nuisance(),
    });
    expect(observation.researchObservationContractVersion).toBe("research-observation-1");
    expect(await verifyResearchObservation(observation)).toBe(true);
  });

  it("keeps a failed capture without a measurement id", async () => {
    const observation = await createResearchObservation({
      observationId: "obs-synth-bowl-001-fail",
      createdAt: "2026-08-25T01:05:00.000Z",
      specimenId: "synth-bowl-001",
      objectFamily: "bowl",
      materialTruthSource: "inspection",
      sessionId: "session-synth-1",
      dayId: "2026-08-20",
      operatorId: "operator-synth",
      stationId: "synth-station-a",
      microphoneDescription: null,
      captureSettings: null,
      striker: "wooden-dowel",
      support: "foam-pad",
      microphoneDistanceCm: 20,
      strikeLocation: "rim-A",
      roomId: "synth-lab-1",
      algorithmRevision: "er-dsp-2",
      softwareRevision: REVISION,
      acquisitionOutcome: "analytical-failure",
      measurementId: null,
      stationStatus: "unqualified",
      nuisance: nuisance(),
    });
    expect(observation.measurementId).toBeNull();
    expect(await verifyResearchObservation(observation)).toBe(true);
  });

  it("refuses a physical specimen crossing train and held-out via different capture IDs", () => {
    const validation = validateResearchSplitPolicy([
      { specimenId: "synth-bowl-001", captureId: "obs-a", primarySplit: "train", challengeSplits: [] },
      { specimenId: "synth-bowl-001", captureId: "obs-b", primarySplit: "held-out", challengeSplits: [] },
    ]);
    expect(validation.valid).toBe(false);
    expect(validation.reasons.some((reason) => /crosses splits/.test(reason))).toBe(true);
  });

  it("sets calibration groupId equal to the physical specimen", () => {
    expect(calibrationGroupId("synth-bowl-001")).toBe("synth-bowl-001");
    const validation = validateResearchSplitPolicy([
      { specimenId: "synth-bowl-001", captureId: "obs-a", primarySplit: "calibration", challengeSplits: [] },
      { specimenId: "synth-cup-001", captureId: "obs-b", primarySplit: "held-out", challengeSplits: ["station-disjoint"] },
    ]);
    expect(validation.valid).toBe(true);
    expect(validation.policyContractVersion).toBe("research-split-policy-1");
  });

  it("freezes content-addressed membership, exclusions, labels, splits, and metrics", async () => {
    const snapshot = await createResearchBenchmarkSnapshot({
      createdAt: "2026-08-25T02:00:00.000Z",
      membershipObservationIds: ["obs-b", "obs-a"],
      exclusions: [{ observationId: "obs-excluded", reason: "quality-failure" }],
      frozenLabels: [{
        specimenId: "synth-bowl-001",
        identity: "custody-tag-synth-bowl-001",
        objectFamily: "bowl",
        material: materialSingle(),
        provenance: { ownership: "research-lab", collectionSite: null, custodyNotes: null },
        displayLabel: "Synthetic brass bowl",
      }],
      frozenSplits: [
        { specimenId: "synth-bowl-001", captureId: "obs-a", primarySplit: "train", challengeSplits: [] },
        { specimenId: "synth-cup-001", captureId: "obs-b", primarySplit: "held-out", challengeSplits: [] },
      ],
      frozenMetrics: ["recall-at-1", "brier"],
    });
    expect(snapshot.benchmarkSnapshotContractVersion).toBe("research-benchmark-snapshot-1");
    expect(snapshot.membershipObservationIds).toEqual(["obs-a", "obs-b"]);
    expect(await verifyResearchBenchmarkSnapshot(snapshot)).toBe(true);
    expect(await verifyResearchBenchmarkSnapshot({ ...snapshot, frozenMetrics: ["brier"] })).toBe(false);
  });

  it("documents R0-R3 numbers as engineering targets, not scientific thresholds", () => {
    expect(DATASET_READINESS_TARGETS.notAScientificThreshold).toBe(true);
    expect(DATASET_READINESS_TARGETS.R0.minimumSpecimens).toBe(24);
    expect(DATASET_READINESS_TARGETS.R1.minimumSpecimens).toBe(100);
    expect(DATASET_READINESS_TARGETS.R2.minimumHeldOutSpecimens).toBe(200);
    expect(DATASET_READINESS_TARGETS.R2.minimumHeldOutQueries).toBe(1000);
    expect(DATASET_READINESS_TARGETS.R3.minimumSpecimens).toBe(500);
    const none = assessDatasetReadiness({
      specimenCount: 1,
      objectFamilyCount: 1,
      materialClassCount: 1,
      minimumObservationsPerSpecimen: 1,
      nuisanceFactorsPerturbed: 0,
      sessionOrDayCount: 1,
      stationCount: 1,
      heldOutSpecimenCount: 0,
      heldOutQueryCount: 0,
    });
    expect(none.stageReached).toBe("none");
    expect(none.notAScientificThreshold).toBe(true);
    const r0 = assessDatasetReadiness({
      specimenCount: 24,
      objectFamilyCount: 8,
      materialClassCount: 3,
      minimumObservationsPerSpecimen: 10,
      nuisanceFactorsPerturbed: 2,
      sessionOrDayCount: 1,
      stationCount: 1,
      heldOutSpecimenCount: 0,
      heldOutQueryCount: 0,
    });
    expect(r0.stageReached).toBe("R0");
  });
});
