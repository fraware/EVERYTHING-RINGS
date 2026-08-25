import type { AtlasContributorV1 } from "./atlas";
import type { MaterialClass } from "./types";
import { canonicalizeContentDigests, contentDigest, isContentDigest } from "./provenance";
import type { StationQualificationStatus } from "./station-calibration";

export const PUBLIC_OBSERVATION_RECORD_CONTRACT_VERSION = "public-observation-record-2" as const;
export const SPECIMEN_RECORD_CONTRACT_VERSION = "specimen-record-2" as const;
export const SPECIMEN_MEMBERSHIP_ASSERTION_CONTRACT_VERSION = "specimen-membership-assertion-2" as const;
export const ATLAS_ASSURANCE_TAXONOMY_CONTRACT_VERSION = "atlas-assurance-taxonomy-2" as const;

export const ATLAS_ASSURANCE_LEVELS_V2 = [
  "self-declared",
  "controlled-physical-registry",
  "calibrated-sonic-twin-supported",
  "independently-reviewed",
] as const;

export type AtlasAssuranceLevelV2 = (typeof ATLAS_ASSURANCE_LEVELS_V2)[number];

export type SpecimenGroundingV2 = "externally-grounded" | "user-grouped";

export type SpecimenMembershipBasisV2 =
  | "contributor-declaration"
  | "controlled-registry"
  | "calibrated-twin"
  | "independent-review";

/**
 * One public capture/measurement. Deliberately has no canonical object identity.
 * Same-object linking is a separate SpecimenMembershipAssertion, never er1-* equality.
 */
export interface PublicObservationRecord {
  readonly schemaVersion: 2;
  readonly observationContractVersion: "public-observation-record-2";
  readonly observationRecordId: string;
  readonly createdAt: string;
  readonly measurementId: string;
  readonly derivationIds: readonly string[];
  readonly contributor: AtlasContributorV1 | null;
  readonly stationId: string;
  readonly stationStatus: StationQualificationStatus;
  readonly rawMicrophoneSamplesIncluded: false;
  readonly publicationConsent: true;
  readonly canonicalObjectIdentity: null;
}

export interface SpecimenRecord {
  readonly schemaVersion: 2;
  readonly specimenContractVersion: "specimen-record-2";
  readonly specimenRecordId: string;
  readonly createdAt: string;
  readonly specimenId: string;
  readonly grounding: SpecimenGroundingV2;
  readonly displayLabel: string;
  readonly objectFamily: string;
  readonly material: MaterialClass | "unknown";
  readonly publicDescription: string | null;
  readonly identitySource: "external-registry" | "user-group";
}

export interface SpecimenMembershipAssertion {
  readonly schemaVersion: 2;
  readonly membershipAssertionContractVersion: "specimen-membership-assertion-2";
  readonly assertionId: string;
  readonly createdAt: string;
  readonly observationRecordId: string;
  readonly specimenRecordId: string;
  readonly basis: SpecimenMembershipBasisV2;
  readonly assurance: AtlasAssuranceLevelV2;
  readonly doesNotEstablish: readonly string[];
}

function requiredText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error(`${field} is required`);
  return trimmed;
}

export async function createPublicObservationRecord(
  input: Omit<PublicObservationRecord, "schemaVersion" | "observationContractVersion" | "observationRecordId" | "rawMicrophoneSamplesIncluded" | "publicationConsent" | "canonicalObjectIdentity">,
): Promise<PublicObservationRecord> {
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("public observation createdAt is invalid");
  if (!isContentDigest(input.measurementId)) throw new Error("public observation measurementId must be a content digest");
  const derivationIds = canonicalizeContentDigests(input.derivationIds, "derivationIds");
  const payload = {
    canonicalObjectIdentity: null,
    contributor: input.contributor,
    createdAt: input.createdAt,
    derivationIds,
    measurementId: input.measurementId,
    observationContractVersion: PUBLIC_OBSERVATION_RECORD_CONTRACT_VERSION,
    publicationConsent: true as const,
    rawMicrophoneSamplesIncluded: false as const,
    schemaVersion: 2 as const,
    stationId: requiredText(input.stationId, "stationId"),
    stationStatus: input.stationStatus,
  };
  return { ...payload, observationRecordId: await contentDigest(payload) };
}

export async function verifyPublicObservationRecord(record: PublicObservationRecord): Promise<boolean> {
  if (record.schemaVersion !== 2 || record.observationContractVersion !== PUBLIC_OBSERVATION_RECORD_CONTRACT_VERSION) return false;
  if (record.canonicalObjectIdentity !== null) return false;
  if (record.rawMicrophoneSamplesIncluded !== false || record.publicationConsent !== true) return false;
  if (!isContentDigest(record.observationRecordId) || !isContentDigest(record.measurementId)) return false;
  if (!Number.isFinite(Date.parse(record.createdAt)) || record.stationId.trim().length === 0) return false;
  const { observationRecordId, ...payload } = record;
  return observationRecordId === await contentDigest(payload);
}

export async function createSpecimenRecord(
  input: Omit<SpecimenRecord, "schemaVersion" | "specimenContractVersion" | "specimenRecordId">,
): Promise<SpecimenRecord> {
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("specimen record createdAt is invalid");
  if (input.grounding === "externally-grounded" && input.identitySource !== "external-registry") {
    throw new Error("externally grounded specimens must use identitySource external-registry");
  }
  if (input.grounding === "user-grouped" && input.identitySource !== "user-group") {
    throw new Error("user-grouped specimens must use identitySource user-group");
  }
  const payload = {
    createdAt: input.createdAt,
    displayLabel: requiredText(input.displayLabel, "displayLabel"),
    grounding: input.grounding,
    identitySource: input.identitySource,
    material: input.material,
    objectFamily: requiredText(input.objectFamily, "objectFamily"),
    publicDescription: input.publicDescription,
    schemaVersion: 2 as const,
    specimenContractVersion: SPECIMEN_RECORD_CONTRACT_VERSION,
    specimenId: requiredText(input.specimenId, "specimenId"),
  };
  return { ...payload, specimenRecordId: await contentDigest(payload) };
}

export async function verifySpecimenRecord(record: SpecimenRecord): Promise<boolean> {
  if (record.schemaVersion !== 2 || record.specimenContractVersion !== SPECIMEN_RECORD_CONTRACT_VERSION) return false;
  if (!isContentDigest(record.specimenRecordId) || !Number.isFinite(Date.parse(record.createdAt))) return false;
  if (record.specimenId.trim().length === 0 || record.displayLabel.trim().length === 0) return false;
  if (record.grounding === "externally-grounded" && record.identitySource !== "external-registry") return false;
  if (record.grounding === "user-grouped" && record.identitySource !== "user-group") return false;
  const { specimenRecordId, ...payload } = record;
  return specimenRecordId === await contentDigest(payload);
}

const MEMBERSHIP_BASES: ReadonlySet<SpecimenMembershipBasisV2> = new Set([
  "contributor-declaration",
  "controlled-registry",
  "calibrated-twin",
  "independent-review",
]);

const ASSURANCE_LEVELS: ReadonlySet<AtlasAssuranceLevelV2> = new Set(ATLAS_ASSURANCE_LEVELS_V2);

function assertMembershipBasis(basis: string): asserts basis is SpecimenMembershipBasisV2 {
  if (/^er1-/i.test(basis) || /fingerprint-equality/i.test(basis) || (/same-object/i.test(basis) && /er1/i.test(basis))) {
    throw new Error("specimen membership cannot be asserted from er1-* equality");
  }
  if (!MEMBERSHIP_BASES.has(basis as SpecimenMembershipBasisV2)) {
    throw new Error("specimen membership basis is invalid");
  }
}

export async function createSpecimenMembershipAssertion(
  input: Omit<SpecimenMembershipAssertion, "schemaVersion" | "membershipAssertionContractVersion" | "assertionId">,
): Promise<SpecimenMembershipAssertion> {
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("membership assertion createdAt is invalid");
  if (!isContentDigest(input.observationRecordId)) throw new Error("membership assertion observationRecordId must be a content digest");
  if (!isContentDigest(input.specimenRecordId)) throw new Error("membership assertion specimenRecordId must be a content digest");
  assertMembershipBasis(input.basis);
  if (!ASSURANCE_LEVELS.has(input.assurance)) throw new Error("membership assertion assurance level is invalid");
  const doesNotEstablish = input.doesNotEstablish.map((item) => requiredText(item, "doesNotEstablish"));
  if (doesNotEstablish.length === 0) throw new Error("membership assertion must state what it does not establish");
  const payload = {
    assurance: input.assurance,
    basis: input.basis,
    createdAt: input.createdAt,
    doesNotEstablish,
    membershipAssertionContractVersion: SPECIMEN_MEMBERSHIP_ASSERTION_CONTRACT_VERSION,
    observationRecordId: input.observationRecordId,
    schemaVersion: 2 as const,
    specimenRecordId: input.specimenRecordId,
  };
  return { ...payload, assertionId: await contentDigest(payload) };
}

export async function verifySpecimenMembershipAssertion(assertion: SpecimenMembershipAssertion): Promise<boolean> {
  if (assertion.schemaVersion !== 2 || assertion.membershipAssertionContractVersion !== SPECIMEN_MEMBERSHIP_ASSERTION_CONTRACT_VERSION) return false;
  if (!isContentDigest(assertion.assertionId) || !isContentDigest(assertion.observationRecordId) || !isContentDigest(assertion.specimenRecordId)) return false;
  if (!Number.isFinite(Date.parse(assertion.createdAt))) return false;
  try {
    assertMembershipBasis(assertion.basis);
  } catch {
    return false;
  }
  if (!ASSURANCE_LEVELS.has(assertion.assurance) || assertion.doesNotEstablish.length === 0) return false;
  const { assertionId, ...payload } = assertion;
  return assertionId === await contentDigest(payload);
}
