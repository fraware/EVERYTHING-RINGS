import type { CaptureSettingsEvidence, MaterialClass } from "./types";
import { contentDigest, isContentDigest } from "./provenance";
import { STATION_QUALIFICATION_STATUSES, type StationQualificationStatus } from "./station-calibration";

export const SPECIMEN_REGISTRY_CONTRACT_VERSION = "specimen-registry-1" as const;
export const SPECIMEN_REGISTRY_ENTRY_CONTRACT_VERSION = "specimen-registry-entry-1" as const;
export const RESEARCH_OBSERVATION_CONTRACT_VERSION = "research-observation-1" as const;
export const RESEARCH_NUISANCE_METADATA_CONTRACT_VERSION = "research-nuisance-metadata-1" as const;
export const RESEARCH_SPLIT_POLICY_CONTRACT_VERSION = "research-split-policy-1" as const;
export const RESEARCH_BENCHMARK_SNAPSHOT_CONTRACT_VERSION = "research-benchmark-snapshot-1" as const;
export const DATASET_READINESS_TARGETS_CONTRACT_VERSION = "dataset-readiness-targets-1" as const;

const GIT_REVISION = /^[0-9a-f]{40}$/;

export type MaterialTruthSource =
  | "manufacturer"
  | "inspection"
  | "expert"
  | "self-declared"
  | "inferred"
  | "unknown";

export type ResearchMaterialClassification = "single" | "multi-material" | "composite/unknown";

export interface ResearchMaterialTruthV1 {
  readonly classification: ResearchMaterialClassification;
  readonly labels: readonly MaterialClass[];
  readonly source: MaterialTruthSource;
}

export interface SpecimenCustodyProvenanceV1 {
  readonly ownership: string | null;
  readonly collectionSite: string | null;
  readonly custodyNotes: string | null;
}

/**
 * Physical specimen identity is established independently of fingerprints,
 * signatures, model scores, and clusters.
 */
export interface SpecimenRegistryEntryV1 {
  readonly schemaVersion: 1;
  readonly specimenEntryContractVersion: "specimen-registry-entry-1";
  readonly entryId: string;
  readonly specimenId: string;
  readonly createdAt: string;
  readonly identity: string;
  readonly objectFamily: string;
  readonly material: ResearchMaterialTruthV1;
  readonly provenance: SpecimenCustodyProvenanceV1;
  readonly displayLabel: string;
}

export interface SpecimenRegistryV1 {
  readonly schemaVersion: 1;
  readonly specimenRegistryContractVersion: "specimen-registry-1";
  readonly registryId: string;
  readonly createdAt: string;
  readonly entries: readonly SpecimenRegistryEntryV1[];
}

export type ResearchAcquisitionOutcome = "success" | "quality-failure" | "analytical-failure";

export interface ResearchNuisanceMetadataV1 {
  readonly contractVersion: "research-nuisance-metadata-1";
  readonly strikeLocation: string;
  readonly striker: string;
  readonly support: string;
  readonly microphoneDistanceCm: number;
  readonly roomId: string;
  readonly stationId: string;
  readonly operatorId: string;
  readonly dayId: string;
  readonly gainProcessing: string;
  readonly orientation: string;
}

export interface ResearchObservationV1 {
  readonly schemaVersion: 1;
  readonly researchObservationContractVersion: "research-observation-1";
  readonly observationId: string;
  readonly createdAt: string;
  readonly specimenId: string;
  readonly objectFamily: string;
  readonly materialTruthSource: MaterialTruthSource;
  readonly sessionId: string;
  readonly dayId: string;
  readonly operatorId: string;
  readonly stationId: string;
  readonly microphoneDescription: string | null;
  readonly captureSettings: CaptureSettingsEvidence | null;
  readonly striker: string;
  readonly support: string;
  readonly microphoneDistanceCm: number;
  readonly strikeLocation: string;
  readonly roomId: string;
  readonly algorithmRevision: string;
  readonly softwareRevision: string;
  readonly acquisitionOutcome: ResearchAcquisitionOutcome;
  readonly measurementId: string | null;
  readonly stationStatus: StationQualificationStatus;
  readonly nuisance: ResearchNuisanceMetadataV1;
}

export type ResearchPrimarySplit = "train" | "calibration" | "held-out";
export type ResearchChallengeSplit = "station-disjoint" | "family-disjoint";

export interface ResearchSplitAssignmentV1 {
  readonly specimenId: string;
  readonly captureId: string;
  readonly primarySplit: ResearchPrimarySplit;
  readonly challengeSplits: readonly ResearchChallengeSplit[];
}

export interface ResearchSplitPolicyValidationV1 {
  readonly valid: boolean;
  readonly policyContractVersion: "research-split-policy-1";
  readonly specimenCount: number;
  readonly captureCount: number;
  readonly reasons: readonly string[];
}

export interface ResearchBenchmarkExclusionV1 {
  readonly observationId: string;
  readonly reason: string;
}

export interface ResearchBenchmarkFrozenLabelV1 {
  readonly specimenId: string;
  readonly identity: string;
  readonly objectFamily: string;
  readonly material: ResearchMaterialTruthV1;
  readonly provenance: SpecimenCustodyProvenanceV1;
  readonly displayLabel: string;
}

export interface ResearchBenchmarkSnapshotV1 {
  readonly schemaVersion: 1;
  readonly benchmarkSnapshotContractVersion: "research-benchmark-snapshot-1";
  readonly snapshotId: string;
  readonly createdAt: string;
  readonly membershipObservationIds: readonly string[];
  readonly membershipDigest: string;
  readonly exclusions: readonly ResearchBenchmarkExclusionV1[];
  readonly frozenLabels: readonly ResearchBenchmarkFrozenLabelV1[];
  readonly frozenSplits: readonly ResearchSplitAssignmentV1[];
  readonly frozenMetrics: readonly string[];
}

export type DatasetReadinessStage = "R0" | "R1" | "R2" | "R3";

/**
 * Engineering targets for dataset readiness. These are not scientific
 * thresholds, not empirical release gates, and not identity/material claims.
 */
export interface DatasetReadinessTargetV1 {
  readonly stage: DatasetReadinessStage;
  readonly kind: "engineering-target";
  readonly notAScientificThreshold: true;
  readonly purpose: string;
  readonly minimumSpecimens: number;
  readonly minimumObjectFamilies: number;
  readonly minimumMaterialClasses: number;
  readonly minimumObservationsPerSpecimen: number;
  readonly minimumNuisanceFactorsPerturbed: number;
  readonly minimumSessionsOrDays: number;
  readonly minimumStations: number;
  readonly minimumHeldOutSpecimens: number;
  readonly minimumHeldOutQueries: number;
}

export const DATASET_READINESS_TARGETS = {
  contractVersion: DATASET_READINESS_TARGETS_CONTRACT_VERSION,
  kind: "engineering-target",
  notAScientificThreshold: true,
  R0: {
    stage: "R0",
    kind: "engineering-target",
    notAScientificThreshold: true,
    purpose: "Protocol shakeout. No identity or material product claim.",
    minimumSpecimens: 24,
    minimumObjectFamilies: 8,
    minimumMaterialClasses: 3,
    minimumObservationsPerSpecimen: 10,
    minimumNuisanceFactorsPerturbed: 2,
    minimumSessionsOrDays: 1,
    minimumStations: 1,
    minimumHeldOutSpecimens: 0,
    minimumHeldOutQueries: 0,
  },
  R1: {
    stage: "R1",
    kind: "engineering-target",
    notAScientificThreshold: true,
    purpose: "Characterize deterministic Twin baseline on a physical development corpus.",
    minimumSpecimens: 100,
    minimumObjectFamilies: 8,
    minimumMaterialClasses: 3,
    minimumObservationsPerSpecimen: 20,
    minimumNuisanceFactorsPerturbed: 2,
    minimumSessionsOrDays: 3,
    minimumStations: 2,
    minimumHeldOutSpecimens: 0,
    minimumHeldOutQueries: 0,
  },
  R2: {
    stage: "R2",
    kind: "engineering-target",
    notAScientificThreshold: true,
    purpose: "Decide whether a physical identity product claim is supportable.",
    minimumSpecimens: 200,
    minimumObjectFamilies: 8,
    minimumMaterialClasses: 3,
    minimumObservationsPerSpecimen: 20,
    minimumNuisanceFactorsPerturbed: 2,
    minimumSessionsOrDays: 3,
    minimumStations: 2,
    minimumHeldOutSpecimens: 200,
    minimumHeldOutQueries: 1000,
  },
  R3: {
    stage: "R3",
    kind: "engineering-target",
    notAScientificThreshold: true,
    purpose: "Atlas-scale corpus with multi-station collection and immutable snapshots.",
    minimumSpecimens: 500,
    minimumObjectFamilies: 8,
    minimumMaterialClasses: 3,
    minimumObservationsPerSpecimen: 20,
    minimumNuisanceFactorsPerturbed: 2,
    minimumSessionsOrDays: 3,
    minimumStations: 3,
    minimumHeldOutSpecimens: 200,
    minimumHeldOutQueries: 1000,
  },
} as const satisfies {
  readonly contractVersion: "dataset-readiness-targets-1";
  readonly kind: "engineering-target";
  readonly notAScientificThreshold: true;
  readonly R0: DatasetReadinessTargetV1;
  readonly R1: DatasetReadinessTargetV1;
  readonly R2: DatasetReadinessTargetV1;
  readonly R3: DatasetReadinessTargetV1;
};

export interface DatasetReadinessStatsV1 {
  readonly specimenCount: number;
  readonly objectFamilyCount: number;
  readonly materialClassCount: number;
  readonly minimumObservationsPerSpecimen: number;
  readonly nuisanceFactorsPerturbed: number;
  readonly sessionOrDayCount: number;
  readonly stationCount: number;
  readonly heldOutSpecimenCount: number;
  readonly heldOutQueryCount: number;
}

export interface DatasetReadinessAssessmentV1 {
  readonly stageReached: DatasetReadinessStage | "none";
  readonly kind: "engineering-target";
  readonly notAScientificThreshold: true;
  readonly deficits: readonly string[];
}

function requiredText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error(`${field} is required`);
  return trimmed;
}

function normalizedKey(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

const MATERIAL_TRUTH_SOURCES: ReadonlySet<MaterialTruthSource> = new Set([
  "manufacturer",
  "inspection",
  "expert",
  "self-declared",
  "inferred",
  "unknown",
]);

export function assertResearchMaterialTruth(material: ResearchMaterialTruthV1): void {
  if (!MATERIAL_TRUTH_SOURCES.has(material.source)) throw new Error("material truth source is invalid");
  if (material.classification === "single") {
    if (material.labels.length !== 1) throw new Error("single-material truth requires exactly one label");
    if (material.labels[0] === "composite") {
      throw new Error("composites must use multi-material or composite/unknown classification");
    }
    return;
  }
  if (material.classification === "multi-material") {
    if (material.labels.length < 2) throw new Error("multi-material truth requires at least two labels");
    return;
  }
  if (material.classification === "composite/unknown") {
    if (material.labels.some((label) => label !== "composite")) {
      throw new Error("composite/unknown may only include the composite label or no labels");
    }
    return;
  }
  throw new Error("material classification is invalid");
}

function assertNuisance(nuisance: ResearchNuisanceMetadataV1): ResearchNuisanceMetadataV1 {
  if (nuisance.contractVersion !== RESEARCH_NUISANCE_METADATA_CONTRACT_VERSION) {
    throw new Error("research nuisance metadata contract mismatch");
  }
  if (!(nuisance.microphoneDistanceCm > 0) || !Number.isFinite(nuisance.microphoneDistanceCm)) {
    throw new Error("microphoneDistanceCm must be finite and positive");
  }
  return {
    contractVersion: RESEARCH_NUISANCE_METADATA_CONTRACT_VERSION,
    strikeLocation: requiredText(nuisance.strikeLocation, "strikeLocation"),
    striker: requiredText(nuisance.striker, "striker"),
    support: requiredText(nuisance.support, "support"),
    microphoneDistanceCm: nuisance.microphoneDistanceCm,
    roomId: requiredText(nuisance.roomId, "roomId"),
    stationId: requiredText(nuisance.stationId, "stationId"),
    operatorId: requiredText(nuisance.operatorId, "operatorId"),
    dayId: requiredText(nuisance.dayId, "dayId"),
    gainProcessing: requiredText(nuisance.gainProcessing, "gainProcessing"),
    orientation: requiredText(nuisance.orientation, "orientation"),
  };
}

export async function createSpecimenRegistryEntry(
  input: Omit<SpecimenRegistryEntryV1, "schemaVersion" | "specimenEntryContractVersion" | "entryId">,
): Promise<SpecimenRegistryEntryV1> {
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("specimen registry createdAt is invalid");
  assertResearchMaterialTruth(input.material);
  const payload = {
    createdAt: input.createdAt,
    displayLabel: requiredText(input.displayLabel, "displayLabel"),
    identity: requiredText(input.identity, "identity"),
    material: {
      classification: input.material.classification,
      labels: [...input.material.labels],
      source: input.material.source,
    },
    objectFamily: requiredText(input.objectFamily, "objectFamily"),
    provenance: {
      collectionSite: input.provenance.collectionSite,
      custodyNotes: input.provenance.custodyNotes,
      ownership: input.provenance.ownership,
    },
    schemaVersion: 1 as const,
    specimenEntryContractVersion: SPECIMEN_REGISTRY_ENTRY_CONTRACT_VERSION,
    specimenId: requiredText(input.specimenId, "specimenId"),
  };
  return { ...payload, entryId: await contentDigest(payload) };
}

export async function verifySpecimenRegistryEntry(entry: SpecimenRegistryEntryV1): Promise<boolean> {
  if (entry.schemaVersion !== 1 || entry.specimenEntryContractVersion !== SPECIMEN_REGISTRY_ENTRY_CONTRACT_VERSION) return false;
  if (!isContentDigest(entry.entryId) || !Number.isFinite(Date.parse(entry.createdAt))) return false;
  try {
    requiredText(entry.specimenId, "specimenId");
    requiredText(entry.identity, "identity");
    requiredText(entry.objectFamily, "objectFamily");
    requiredText(entry.displayLabel, "displayLabel");
    assertResearchMaterialTruth(entry.material);
  } catch {
    return false;
  }
  const { entryId, ...payload } = entry;
  return entryId === await contentDigest(payload);
}

export async function createSpecimenRegistry(
  input: Omit<SpecimenRegistryV1, "schemaVersion" | "specimenRegistryContractVersion" | "registryId">,
): Promise<SpecimenRegistryV1> {
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("specimen registry createdAt is invalid");
  if (input.entries.length === 0) throw new Error("specimen registry requires at least one entry");
  const seen = new Set<string>();
  for (const entry of input.entries) {
    if (!await verifySpecimenRegistryEntry(entry)) throw new Error(`specimen registry entry ${entry.specimenId} failed verification`);
    const key = normalizedKey(entry.specimenId);
    if (seen.has(key)) throw new Error(`duplicate physical specimenId ${entry.specimenId}`);
    seen.add(key);
  }
  const entries = [...input.entries].sort((left, right) => left.specimenId.localeCompare(right.specimenId, "en-US"));
  const payload = {
    createdAt: input.createdAt,
    entries,
    schemaVersion: 1 as const,
    specimenRegistryContractVersion: SPECIMEN_REGISTRY_CONTRACT_VERSION,
  };
  return { ...payload, registryId: await contentDigest(payload) };
}

export async function verifySpecimenRegistry(registry: SpecimenRegistryV1): Promise<boolean> {
  if (registry.schemaVersion !== 1 || registry.specimenRegistryContractVersion !== SPECIMEN_REGISTRY_CONTRACT_VERSION) return false;
  if (!isContentDigest(registry.registryId) || !Number.isFinite(Date.parse(registry.createdAt))) return false;
  if (registry.entries.length === 0) return false;
  const seen = new Set<string>();
  for (const entry of registry.entries) {
    if (!await verifySpecimenRegistryEntry(entry)) return false;
    const key = normalizedKey(entry.specimenId);
    if (seen.has(key)) return false;
    seen.add(key);
  }
  const canonical = [...registry.entries].sort((left, right) => left.specimenId.localeCompare(right.specimenId, "en-US"));
  if (canonical.map((entry) => entry.entryId).join("\0") !== registry.entries.map((entry) => entry.entryId).join("\0")) return false;
  const { registryId, ...payload } = registry;
  return registryId === await contentDigest(payload);
}

export function researchObservationNuisance(observation: ResearchObservationV1): ResearchNuisanceMetadataV1 {
  return assertNuisance(observation.nuisance);
}

export async function createResearchObservation(
  input: Omit<ResearchObservationV1, "schemaVersion" | "researchObservationContractVersion" | "observationId"> & {
    readonly observationId?: string;
  },
): Promise<ResearchObservationV1> {
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("research observation createdAt is invalid");
  if (!GIT_REVISION.test(input.softwareRevision)) throw new Error("research observation softwareRevision must be exact 40-hex Git revision");
  if (input.algorithmRevision.trim().length === 0) throw new Error("research observation algorithmRevision is required");
  if (!(input.microphoneDistanceCm > 0) || !Number.isFinite(input.microphoneDistanceCm)) {
    throw new Error("research observation microphoneDistanceCm must be finite and positive");
  }
  if (input.acquisitionOutcome === "success") {
    if (input.measurementId === null || !isContentDigest(input.measurementId)) {
      throw new Error("successful research observation requires a measurement content digest");
    }
  } else if (input.measurementId !== null) {
    throw new Error("failed research observation must not carry a measurementId");
  }
  if (!STATION_QUALIFICATION_STATUSES.includes(input.stationStatus)) {
    throw new Error("research observation stationStatus is invalid");
  }
  const nuisance = assertNuisance(input.nuisance);
  if (normalizedKey(nuisance.stationId) !== normalizedKey(input.stationId)) throw new Error("nuisance stationId must match observation stationId");
  if (normalizedKey(nuisance.operatorId) !== normalizedKey(input.operatorId)) throw new Error("nuisance operatorId must match observation operatorId");
  if (normalizedKey(nuisance.dayId) !== normalizedKey(input.dayId)) throw new Error("nuisance dayId must match observation dayId");
  const payload = {
    acquisitionOutcome: input.acquisitionOutcome,
    algorithmRevision: input.algorithmRevision.trim(),
    captureSettings: input.captureSettings,
    createdAt: input.createdAt,
    dayId: requiredText(input.dayId, "dayId"),
    materialTruthSource: input.materialTruthSource,
    measurementId: input.measurementId,
    microphoneDescription: input.microphoneDescription,
    microphoneDistanceCm: input.microphoneDistanceCm,
    nuisance,
    objectFamily: requiredText(input.objectFamily, "objectFamily"),
    operatorId: requiredText(input.operatorId, "operatorId"),
    researchObservationContractVersion: RESEARCH_OBSERVATION_CONTRACT_VERSION,
    roomId: requiredText(input.roomId, "roomId"),
    schemaVersion: 1 as const,
    sessionId: requiredText(input.sessionId, "sessionId"),
    softwareRevision: input.softwareRevision,
    specimenId: requiredText(input.specimenId, "specimenId"),
    stationId: requiredText(input.stationId, "stationId"),
    stationStatus: input.stationStatus,
    strikeLocation: requiredText(input.strikeLocation, "strikeLocation"),
    striker: requiredText(input.striker, "striker"),
    support: requiredText(input.support, "support"),
  };
  const observationId = input.observationId?.trim().length
    ? requiredText(input.observationId, "observationId")
    : await contentDigest(payload);
  return { ...payload, observationId };
}

export async function verifyResearchObservation(observation: ResearchObservationV1): Promise<boolean> {
  if (observation.schemaVersion !== 1 || observation.researchObservationContractVersion !== RESEARCH_OBSERVATION_CONTRACT_VERSION) return false;
  if (observation.observationId.trim().length === 0 || !Number.isFinite(Date.parse(observation.createdAt))) return false;
  if (!GIT_REVISION.test(observation.softwareRevision) || observation.algorithmRevision.trim().length === 0) return false;
  if (observation.acquisitionOutcome === "success") {
    if (observation.measurementId === null || !isContentDigest(observation.measurementId)) return false;
  } else if (observation.measurementId !== null) return false;
  if (!STATION_QUALIFICATION_STATUSES.includes(observation.stationStatus)) return false;
  try {
    assertNuisance(observation.nuisance);
    requiredText(observation.specimenId, "specimenId");
    requiredText(observation.objectFamily, "objectFamily");
  } catch {
    return false;
  }
  return MATERIAL_TRUTH_SOURCES.has(observation.materialTruthSource);
}

export function calibrationGroupId(specimenId: string): string {
  return requiredText(specimenId, "specimenId");
}

const PRIMARY_SPLITS: ReadonlySet<ResearchPrimarySplit> = new Set(["train", "calibration", "held-out"]);
const CHALLENGE_SPLITS: ReadonlySet<ResearchChallengeSplit> = new Set(["station-disjoint", "family-disjoint"]);

export function validateResearchSplitPolicy(
  assignments: readonly ResearchSplitAssignmentV1[],
): ResearchSplitPolicyValidationV1 {
  const reasons: string[] = [];
  if (assignments.length === 0) reasons.push("split policy requires at least one assignment");
  const specimenPrimary = new Map<string, ResearchPrimarySplit>();
  const captureIds = new Set<string>();
  for (const assignment of assignments) {
    const specimenId = normalizedKey(assignment.specimenId);
    const captureId = assignment.captureId.trim();
    if (specimenId.length === 0) reasons.push("split assignment specimenId is required");
    if (captureId.length === 0) reasons.push("split assignment captureId is required");
    if (captureIds.has(captureId)) reasons.push(`duplicate captureId ${assignment.captureId}`);
    captureIds.add(captureId);
    if (!PRIMARY_SPLITS.has(assignment.primarySplit)) reasons.push(`invalid primary split ${String(assignment.primarySplit)}`);
    for (const challenge of assignment.challengeSplits) {
      if (!CHALLENGE_SPLITS.has(challenge)) reasons.push(`invalid challenge split ${String(challenge)}`);
    }
    if (assignment.challengeSplits.length > 0 && assignment.primarySplit !== "held-out") {
      reasons.push(`challenge splits on capture ${assignment.captureId} may only apply to held-out specimens`);
    }
    const prior = specimenPrimary.get(specimenId);
    if (prior !== undefined && prior !== assignment.primarySplit) {
      reasons.push(`physical specimen ${assignment.specimenId} crosses splits via capture ${assignment.captureId}`);
    } else {
      specimenPrimary.set(specimenId, assignment.primarySplit);
    }
    if (assignment.primarySplit === "calibration") {
      const groupId = calibrationGroupId(assignment.specimenId);
      if (normalizedKey(groupId) !== specimenId) {
        reasons.push(`calibration groupId must equal physical specimen ${assignment.specimenId}`);
      }
    }
  }
  return {
    valid: reasons.length === 0,
    policyContractVersion: RESEARCH_SPLIT_POLICY_CONTRACT_VERSION,
    specimenCount: specimenPrimary.size,
    captureCount: captureIds.size,
    reasons: [...new Set(reasons)],
  };
}

function canonicalizeExclusions(exclusions: readonly ResearchBenchmarkExclusionV1[]): ResearchBenchmarkExclusionV1[] {
  const seen = new Set<string>();
  const canonical: ResearchBenchmarkExclusionV1[] = [];
  for (const exclusion of exclusions) {
    const observationId = requiredText(exclusion.observationId, "exclusion observationId");
    if (seen.has(observationId)) throw new Error(`duplicate exclusion ${observationId}`);
    seen.add(observationId);
    canonical.push({ observationId, reason: requiredText(exclusion.reason, "exclusion reason") });
  }
  return canonical.sort((left, right) => left.observationId.localeCompare(right.observationId, "en-US"));
}

function canonicalizeFrozenLabels(labels: readonly ResearchBenchmarkFrozenLabelV1[]): ResearchBenchmarkFrozenLabelV1[] {
  const seen = new Set<string>();
  const canonical: ResearchBenchmarkFrozenLabelV1[] = [];
  for (const label of labels) {
    assertResearchMaterialTruth(label.material);
    const specimenId = requiredText(label.specimenId, "frozen label specimenId");
    const key = normalizedKey(specimenId);
    if (seen.has(key)) throw new Error(`duplicate frozen label for ${specimenId}`);
    seen.add(key);
    canonical.push({
      displayLabel: requiredText(label.displayLabel, "displayLabel"),
      identity: requiredText(label.identity, "identity"),
      material: {
        classification: label.material.classification,
        labels: [...label.material.labels],
        source: label.material.source,
      },
      objectFamily: requiredText(label.objectFamily, "objectFamily"),
      provenance: {
        collectionSite: label.provenance.collectionSite,
        custodyNotes: label.provenance.custodyNotes,
        ownership: label.provenance.ownership,
      },
      specimenId,
    });
  }
  return canonical.sort((left, right) => left.specimenId.localeCompare(right.specimenId, "en-US"));
}

export async function createResearchBenchmarkSnapshot(
  input: Omit<ResearchBenchmarkSnapshotV1, "schemaVersion" | "benchmarkSnapshotContractVersion" | "snapshotId" | "membershipDigest">,
): Promise<ResearchBenchmarkSnapshotV1> {
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("benchmark snapshot createdAt is invalid");
  if (input.membershipObservationIds.length === 0) throw new Error("benchmark snapshot requires frozen membership");
  const trimmedMembership = input.membershipObservationIds.map((id) => requiredText(id, "membership observationId"));
  if (new Set(trimmedMembership).size !== trimmedMembership.length) {
    throw new Error("benchmark snapshot membership must not contain duplicates");
  }
  const membershipObservationIds = [...trimmedMembership].sort((left, right) => left.localeCompare(right, "en-US"));
  const exclusions = canonicalizeExclusions(input.exclusions);
  for (const exclusion of exclusions) {
    if (membershipObservationIds.includes(exclusion.observationId)) {
      throw new Error(`excluded observation ${exclusion.observationId} cannot remain in frozen membership`);
    }
  }
  const frozenLabels = canonicalizeFrozenLabels(input.frozenLabels);
  const splitValidation = validateResearchSplitPolicy(input.frozenSplits);
  if (!splitValidation.valid) throw new Error(`frozen splits violate specimen-disjoint policy: ${splitValidation.reasons.join("; ")}`);
  const frozenSplits = [...input.frozenSplits].sort((left, right) =>
    left.specimenId.localeCompare(right.specimenId, "en-US") || left.captureId.localeCompare(right.captureId, "en-US"),
  );
  for (const assignment of frozenSplits) {
    if (!membershipObservationIds.includes(assignment.captureId)) {
      throw new Error(`frozen split capture ${assignment.captureId} is not in snapshot membership`);
    }
  }
  const frozenMetrics = [...new Set(input.frozenMetrics.map((metric) => requiredText(metric, "frozen metric")))]
    .sort((left, right) => left.localeCompare(right, "en-US"));
  if (frozenMetrics.length === 0) throw new Error("benchmark snapshot requires frozen metrics");
  const membershipDigest = await contentDigest(membershipObservationIds);
  const payload = {
    benchmarkSnapshotContractVersion: RESEARCH_BENCHMARK_SNAPSHOT_CONTRACT_VERSION,
    createdAt: input.createdAt,
    exclusions,
    frozenLabels,
    frozenMetrics,
    frozenSplits,
    membershipDigest,
    membershipObservationIds,
    schemaVersion: 1 as const,
  };
  return { ...payload, snapshotId: await contentDigest(payload) };
}

export async function verifyResearchBenchmarkSnapshot(snapshot: ResearchBenchmarkSnapshotV1): Promise<boolean> {
  if (snapshot.schemaVersion !== 1 || snapshot.benchmarkSnapshotContractVersion !== RESEARCH_BENCHMARK_SNAPSHOT_CONTRACT_VERSION) return false;
  if (!isContentDigest(snapshot.snapshotId) || !isContentDigest(snapshot.membershipDigest)) return false;
  if (!Number.isFinite(Date.parse(snapshot.createdAt)) || snapshot.membershipObservationIds.length === 0) return false;
  if (snapshot.frozenMetrics.length === 0) return false;
  const splitValidation = validateResearchSplitPolicy(snapshot.frozenSplits);
  if (!splitValidation.valid) return false;
  if (await contentDigest(snapshot.membershipObservationIds) !== snapshot.membershipDigest) return false;
  const { snapshotId, ...payload } = snapshot;
  return snapshotId === await contentDigest(payload);
}

function meetsTarget(stats: DatasetReadinessStatsV1, target: DatasetReadinessTargetV1): readonly string[] {
  const deficits: string[] = [];
  if (stats.specimenCount < target.minimumSpecimens) deficits.push(`${target.stage} specimens ${stats.specimenCount} < ${target.minimumSpecimens}`);
  if (stats.objectFamilyCount < target.minimumObjectFamilies) deficits.push(`${target.stage} families ${stats.objectFamilyCount} < ${target.minimumObjectFamilies}`);
  if (stats.materialClassCount < target.minimumMaterialClasses) deficits.push(`${target.stage} material classes ${stats.materialClassCount} < ${target.minimumMaterialClasses}`);
  if (stats.minimumObservationsPerSpecimen < target.minimumObservationsPerSpecimen) {
    deficits.push(`${target.stage} observations/specimen ${stats.minimumObservationsPerSpecimen} < ${target.minimumObservationsPerSpecimen}`);
  }
  if (stats.nuisanceFactorsPerturbed < target.minimumNuisanceFactorsPerturbed) {
    deficits.push(`${target.stage} nuisance factors ${stats.nuisanceFactorsPerturbed} < ${target.minimumNuisanceFactorsPerturbed}`);
  }
  if (stats.sessionOrDayCount < target.minimumSessionsOrDays) deficits.push(`${target.stage} sessions/days ${stats.sessionOrDayCount} < ${target.minimumSessionsOrDays}`);
  if (stats.stationCount < target.minimumStations) deficits.push(`${target.stage} stations ${stats.stationCount} < ${target.minimumStations}`);
  if (stats.heldOutSpecimenCount < target.minimumHeldOutSpecimens) {
    deficits.push(`${target.stage} held-out specimens ${stats.heldOutSpecimenCount} < ${target.minimumHeldOutSpecimens}`);
  }
  if (stats.heldOutQueryCount < target.minimumHeldOutQueries) {
    deficits.push(`${target.stage} held-out queries ${stats.heldOutQueryCount} < ${target.minimumHeldOutQueries}`);
  }
  return deficits;
}

export function assessDatasetReadiness(stats: DatasetReadinessStatsV1): DatasetReadinessAssessmentV1 {
  const stages: readonly DatasetReadinessStage[] = ["R3", "R2", "R1", "R0"];
  for (const stage of stages) {
    const deficits = meetsTarget(stats, DATASET_READINESS_TARGETS[stage]);
    if (deficits.length === 0) {
      return {
        stageReached: stage,
        kind: "engineering-target",
        notAScientificThreshold: true,
        deficits: [],
      };
    }
  }
  return {
    stageReached: "none",
    kind: "engineering-target",
    notAScientificThreshold: true,
    deficits: meetsTarget(stats, DATASET_READINESS_TARGETS.R0),
  };
}
