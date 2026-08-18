import { evaluateGateASession } from "./evaluate";
import type { FixedSetupProtocol, MaterialClass, ValidationEvidenceV5 } from "./types";

export type EmpiricalCampaignCohort = "release-core" | "challenge";

export interface EmpiricalCampaignSpecimen {
  readonly specimenId: string;
  readonly label: string;
  readonly material: MaterialClass;
  readonly cohort: EmpiricalCampaignCohort;
  readonly objectFamily: string;
  readonly targetSessions: number;
  readonly protocol: FixedSetupProtocol;
}

export interface EmpiricalCampaignV1 {
  readonly schemaVersion: 1;
  readonly campaignContractVersion: "empirical-campaign-1";
  readonly campaignId: string;
  readonly createdAt: string;
  readonly authorizedSoftwareRevision: string;
  readonly specimens: readonly EmpiricalCampaignSpecimen[];
}

export interface EmpiricalCampaignSpecimenStatus {
  readonly specimenId: string;
  readonly label: string;
  readonly material: MaterialClass;
  readonly cohort: EmpiricalCampaignCohort;
  readonly targetSessions: number;
  readonly collectedSessionCount: number;
  readonly conformingCompleteSessionCount: number;
  readonly passingSessionCount: number;
  readonly analyticalFailureCount: number;
  readonly complete: boolean;
  readonly reasons: readonly string[];
}

export interface EmpiricalCampaignProgress {
  readonly campaignId: string;
  readonly campaignSignature: string;
  readonly authorizedSoftwareRevision: string;
  readonly plannedSpecimenCount: number;
  readonly plannedSessionCount: number;
  readonly collectedPlannedSessionCount: number;
  readonly conformingCompleteSessionCount: number;
  readonly passingSessionCount: number;
  readonly analyticalFailureCount: number;
  readonly unplannedSpecimenIds: readonly string[];
  readonly materialCoverage: readonly MaterialClass[];
  readonly collectionComplete: boolean;
  readonly specimens: readonly EmpiricalCampaignSpecimenStatus[];
  readonly reasons: readonly string[];
}

export type EmpiricalCampaignParseResult =
  | { readonly ok: true; readonly campaign: EmpiricalCampaignV1 }
  | { readonly ok: false; readonly error: string };

const SOFTWARE_REVISION_PATTERN = /^[0-9a-f]{40}$/;
const MATERIALS = new Set<MaterialClass>([
  "metal",
  "glass",
  "ceramic",
  "wood",
  "stone",
  "plastic",
  "composite",
  "other",
]);
const COHORTS = new Set<EmpiricalCampaignCohort>(["release-core", "challenge"]);

function normalizedIdentifier(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonemptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function finitePositive(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !(value > 0)) {
    throw new TypeError(`${field} must be finite and positive`);
  }
  return value;
}

function parseProtocol(value: unknown, field: string): FixedSetupProtocol {
  if (!isRecord(value) || value.fixedSetup !== true) {
    throw new TypeError(`${field} must be a fixed setup protocol`);
  }
  return {
    fixedSetup: true,
    microphoneDistanceCm: finitePositive(value.microphoneDistanceCm, `${field}.microphoneDistanceCm`),
    striker: nonemptyString(value.striker, `${field}.striker`),
    strikeLocation: nonemptyString(value.strikeLocation, `${field}.strikeLocation`),
    supportCondition: nonemptyString(value.supportCondition, `${field}.supportCondition`),
  };
}

function parseSpecimen(value: unknown, index: number): EmpiricalCampaignSpecimen {
  const field = `specimens[${index}]`;
  if (!isRecord(value)) throw new TypeError(`${field} must be an object`);
  const material = value.material;
  if (typeof material !== "string" || !MATERIALS.has(material as MaterialClass)) {
    throw new TypeError(`${field}.material is invalid`);
  }
  const cohort = value.cohort;
  if (typeof cohort !== "string" || !COHORTS.has(cohort as EmpiricalCampaignCohort)) {
    throw new TypeError(`${field}.cohort is invalid`);
  }
  const targetSessions = value.targetSessions;
  if (!Number.isInteger(targetSessions) || typeof targetSessions !== "number" || targetSessions <= 0) {
    throw new TypeError(`${field}.targetSessions must be a positive integer`);
  }
  return {
    specimenId: nonemptyString(value.specimenId, `${field}.specimenId`),
    label: nonemptyString(value.label, `${field}.label`),
    material: material as MaterialClass,
    cohort: cohort as EmpiricalCampaignCohort,
    objectFamily: nonemptyString(value.objectFamily, `${field}.objectFamily`),
    targetSessions,
    protocol: parseProtocol(value.protocol, `${field}.protocol`),
  };
}

export function parseEmpiricalCampaign(value: unknown): EmpiricalCampaignParseResult {
  try {
    if (!isRecord(value)) throw new TypeError("campaign must be an object");
    if (value.schemaVersion !== 1) throw new TypeError("schemaVersion must be 1");
    if (value.campaignContractVersion !== "empirical-campaign-1") {
      throw new TypeError("campaignContractVersion must be empirical-campaign-1");
    }
    const campaignId = nonemptyString(value.campaignId, "campaignId");
    const createdAt = nonemptyString(value.createdAt, "createdAt");
    if (!Number.isFinite(Date.parse(createdAt))) throw new TypeError("createdAt must be an ISO-compatible timestamp");
    const authorizedSoftwareRevision = nonemptyString(
      value.authorizedSoftwareRevision,
      "authorizedSoftwareRevision",
    );
    if (!SOFTWARE_REVISION_PATTERN.test(authorizedSoftwareRevision)) {
      throw new TypeError("authorizedSoftwareRevision must be an exact 40-hex Git revision");
    }
    if (!Array.isArray(value.specimens) || value.specimens.length === 0) {
      throw new TypeError("specimens must contain at least one planned physical specimen");
    }
    const specimens = value.specimens.map(parseSpecimen);
    const seen = new Set<string>();
    for (const specimen of specimens) {
      const identifier = normalizedIdentifier(specimen.specimenId);
      if (seen.has(identifier)) throw new TypeError(`duplicate specimenId ${specimen.specimenId}`);
      seen.add(identifier);
    }
    return {
      ok: true,
      campaign: {
        schemaVersion: 1,
        campaignContractVersion: "empirical-campaign-1",
        campaignId,
        createdAt,
        authorizedSoftwareRevision,
        specimens,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function parseEmpiricalCampaignJson(json: string): EmpiricalCampaignParseResult {
  try {
    return parseEmpiricalCampaign(JSON.parse(json) as unknown);
  } catch (error) {
    return { ok: false, error: `invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function canonicalProtocol(protocol: FixedSetupProtocol): string {
  return [
    protocol.microphoneDistanceCm.toString(),
    protocol.striker.trim(),
    protocol.strikeLocation.trim(),
    protocol.supportCondition.trim(),
  ].join("|");
}

export function empiricalCampaignSignature(campaign: EmpiricalCampaignV1): string {
  const canonicalSpecimens = [...campaign.specimens]
    .sort((left, right) => normalizedIdentifier(left.specimenId).localeCompare(normalizedIdentifier(right.specimenId)))
    .map((specimen) => [
      normalizedIdentifier(specimen.specimenId),
      specimen.label.trim(),
      specimen.material,
      specimen.cohort,
      specimen.objectFamily.trim(),
      specimen.targetSessions.toString(),
      canonicalProtocol(specimen.protocol),
    ].join("~"))
    .join(";");
  const canonical = [
    campaign.campaignContractVersion,
    campaign.campaignId.trim(),
    campaign.authorizedSoftwareRevision,
    canonicalSpecimens,
  ].join("::");
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= BigInt(canonical.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return `erc1-${hash.toString(16).padStart(16, "0")}`;
}

function protocolMatches(left: FixedSetupProtocol, right: FixedSetupProtocol): boolean {
  return left.microphoneDistanceCm === right.microphoneDistanceCm
    && left.striker.trim() === right.striker.trim()
    && left.strikeLocation.trim() === right.strikeLocation.trim()
    && left.supportCondition.trim() === right.supportCondition.trim();
}

function pushUnique(reasons: string[], reason: string): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

export function evaluateEmpiricalCampaign(
  campaign: EmpiricalCampaignV1,
  evidence: readonly ValidationEvidenceV5[],
): EmpiricalCampaignProgress {
  const plannedIds = new Set(campaign.specimens.map((specimen) => normalizedIdentifier(specimen.specimenId)));
  const unplannedSpecimenIds = [...new Set(
    evidence
      .filter((bundle) => !plannedIds.has(normalizedIdentifier(bundle.object.specimenId)))
      .map((bundle) => bundle.object.specimenId.trim()),
  )].sort((left, right) => left.localeCompare(right));

  const statuses = campaign.specimens.map((specimen): EmpiricalCampaignSpecimenStatus => {
    const identifier = normalizedIdentifier(specimen.specimenId);
    const sessions = evidence.filter((bundle) => normalizedIdentifier(bundle.object.specimenId) === identifier);
    const reasons: string[] = [];
    const conforming = sessions.filter((bundle) => {
      const identityMatches = bundle.object.label.trim() === specimen.label.trim()
        && bundle.object.material === specimen.material;
      const revisionMatches = bundle.softwareRevision === campaign.authorizedSoftwareRevision;
      const setupMatches = protocolMatches(bundle.protocol, specimen.protocol);
      const attemptsComplete = bundle.attemptCount === 5 && bundle.attempts.length === 5;
      if (!identityMatches) pushUnique(reasons, "object label or material differs from the precommitted specimen");
      if (!revisionMatches) pushUnique(reasons, "session uses a different software revision");
      if (!setupMatches) pushUnique(reasons, "fixed setup differs from the precommitted protocol");
      if (!attemptsComplete) pushUnique(reasons, "session does not contain exactly five qualified attempts");
      return identityMatches && revisionMatches && setupMatches && attemptsComplete;
    });
    if (sessions.length === 0) reasons.push("no session collected");
    if (conforming.length < specimen.targetSessions) {
      pushUnique(reasons, `requires ${specimen.targetSessions} conforming complete session${specimen.targetSessions === 1 ? "" : "s"}`);
    }
    if (sessions.length > specimen.targetSessions) {
      pushUnique(reasons, "more sessions were collected than precommitted");
    }
    const passingSessionCount = conforming.filter((bundle) => evaluateGateASession(bundle).passed).length;
    const analyticalFailureCount = conforming.reduce(
      (total, bundle) => total + bundle.attempts.filter((attempt) => attempt.analysis.status === "failure").length,
      0,
    );
    return {
      specimenId: specimen.specimenId,
      label: specimen.label,
      material: specimen.material,
      cohort: specimen.cohort,
      targetSessions: specimen.targetSessions,
      collectedSessionCount: sessions.length,
      conformingCompleteSessionCount: conforming.length,
      passingSessionCount,
      analyticalFailureCount,
      complete: reasons.length === 0 && conforming.length === specimen.targetSessions,
      reasons,
    };
  });

  const reasons: string[] = [];
  if (unplannedSpecimenIds.length > 0) reasons.push("evidence contains specimens absent from the precommitted campaign");
  const incomplete = statuses.filter((status) => !status.complete);
  if (incomplete.length > 0) reasons.push(`${incomplete.length} planned specimen${incomplete.length === 1 ? " is" : "s are"} incomplete or nonconforming`);
  const plannedSessionCount = campaign.specimens.reduce((total, specimen) => total + specimen.targetSessions, 0);
  const materialCoverage = [...new Set(
    statuses.filter((status) => status.conformingCompleteSessionCount > 0).map((status) => status.material),
  )];

  return {
    campaignId: campaign.campaignId,
    campaignSignature: empiricalCampaignSignature(campaign),
    authorizedSoftwareRevision: campaign.authorizedSoftwareRevision,
    plannedSpecimenCount: campaign.specimens.length,
    plannedSessionCount,
    collectedPlannedSessionCount: statuses.reduce((total, status) => total + status.collectedSessionCount, 0),
    conformingCompleteSessionCount: statuses.reduce((total, status) => total + status.conformingCompleteSessionCount, 0),
    passingSessionCount: statuses.reduce((total, status) => total + status.passingSessionCount, 0),
    analyticalFailureCount: statuses.reduce((total, status) => total + status.analyticalFailureCount, 0),
    unplannedSpecimenIds,
    materialCoverage,
    collectionComplete: reasons.length === 0,
    specimens: statuses,
    reasons,
  };
}
