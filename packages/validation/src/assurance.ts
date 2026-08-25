import { contentDigest } from "./provenance";

export type EvidenceDomain = "software" | "digital-twin" | "external-dataset" | "physical" | "human-perceptual" | "playback-transducer";

export interface AssuranceEvidenceReferenceV1 {
  readonly evidenceId: string;
  readonly domain: EvidenceDomain;
  readonly description: string;
}

export interface CapabilityClaimV1 {
  readonly schemaVersion: 1;
  readonly claimContractVersion: "capability-claim-1";
  readonly claimId: string;
  readonly createdAt: string;
  readonly capability: string;
  readonly proposition: string;
  readonly scope: string;
  readonly exclusions: readonly string[];
  readonly evidence: readonly AssuranceEvidenceReferenceV1[];
  readonly maturity: "implemented" | "software-qualified" | "empirically-qualified";
}

function isContentDigest(id: string): boolean {
  return /^sha256:[0-9a-f]{64}$/.test(id);
}

function assertEvidenceId(id: string): void {
  if (!isContentDigest(id) && !/^[0-9a-f]{40}$/.test(id) && !/^github-run:\d+$/.test(id)) {
    throw new Error("assurance evidenceId must be a SHA-256 digest, Git revision, or github-run:<id>");
  }
}

export async function createCapabilityClaim(
  input: Omit<CapabilityClaimV1, "schemaVersion" | "claimContractVersion" | "claimId">,
): Promise<CapabilityClaimV1> {
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("capability claim createdAt is invalid");
  if (input.capability.trim().length === 0 || input.proposition.trim().length === 0 || input.scope.trim().length === 0) throw new Error("capability claim requires capability, proposition, and scope");
  if (input.evidence.length === 0) throw new Error("capability claim requires evidence references");
  for (const reference of input.evidence) {
    assertEvidenceId(reference.evidenceId);
    if (reference.description.trim().length === 0) throw new Error("assurance evidence description is required");
  }
  if (input.maturity === "software-qualified" && input.evidence.every((reference) => reference.domain !== "software" && reference.domain !== "digital-twin")) {
    throw new Error("software-qualified claim requires software or digital-twin evidence");
  }
  if (input.maturity === "empirically-qualified" && !input.evidence.some((reference) => reference.domain === "physical" || reference.domain === "human-perceptual" || reference.domain === "playback-transducer")) {
    throw new Error("empirically-qualified claim requires empirical-domain evidence");
  }
  const payload = {
    ...input,
    exclusions: [...input.exclusions],
    evidence: [...input.evidence],
    schemaVersion: 1 as const,
    claimContractVersion: "capability-claim-1" as const,
  };
  return { ...payload, claimId: await contentDigest(payload) };
}

export async function verifyCapabilityClaim(claim: CapabilityClaimV1): Promise<boolean> {
  if (claim.schemaVersion !== 1 || claim.claimContractVersion !== "capability-claim-1") return false;
  if (!isContentDigest(claim.claimId) || !Number.isFinite(Date.parse(claim.createdAt))) return false;
  if (claim.capability.trim().length === 0 || claim.proposition.trim().length === 0 || claim.scope.trim().length === 0 || claim.evidence.length === 0) return false;
  if (!claim.evidence.every((reference) => {
    try { assertEvidenceId(reference.evidenceId); } catch { return false; }
    return reference.description.trim().length > 0;
  })) return false;
  const { claimId, ...payload } = claim;
  return claimId === await contentDigest(payload);
}

export interface SoftwareQualificationManifestV1 {
  readonly schemaVersion: 1;
  readonly qualificationContractVersion: "full-vision-software-manifest-1";
  readonly manifestId: string;
  readonly sourceRevision: string;
  readonly createdAt: string;
  readonly testRunIds: readonly string[];
  readonly capabilityClaimIds: readonly string[];
  readonly physicalObjectTested: false;
  readonly humanPerceptualValidationPerformed: false;
  readonly realPlaybackTransducerValidated: false;
  readonly releaseGateEquivalent: false;
}

export async function createSoftwareQualificationManifest(
  input: Omit<SoftwareQualificationManifestV1, "schemaVersion" | "qualificationContractVersion" | "manifestId" | "physicalObjectTested" | "humanPerceptualValidationPerformed" | "realPlaybackTransducerValidated" | "releaseGateEquivalent">,
): Promise<SoftwareQualificationManifestV1> {
  if (!/^[0-9a-f]{40}$/.test(input.sourceRevision)) throw new Error("software qualification sourceRevision must be exact 40-hex Git revision");
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("software qualification createdAt is invalid");
  if (input.testRunIds.length === 0) throw new Error("software qualification requires at least one test run");
  if (input.capabilityClaimIds.length === 0) throw new Error("software qualification requires at least one capability claim");
  input.testRunIds.forEach((id) => { if (!/^github-run:\d+$/.test(id)) throw new Error("testRunIds must use github-run:<id>"); });
  input.capabilityClaimIds.forEach((id) => { if (!isContentDigest(id)) throw new Error("capabilityClaimIds must be SHA-256 claim digests"); });
  const testRunIds = [...new Set(input.testRunIds)].sort();
  const capabilityClaimIds = [...new Set(input.capabilityClaimIds)].sort();
  if (testRunIds.length !== input.testRunIds.length) throw new Error("software qualification testRunIds must be unique");
  if (capabilityClaimIds.length !== input.capabilityClaimIds.length) throw new Error("software qualification capabilityClaimIds must be unique");
  const payload = {
    ...input,
    testRunIds,
    capabilityClaimIds,
    schemaVersion: 1 as const,
    qualificationContractVersion: "full-vision-software-manifest-1" as const,
    physicalObjectTested: false as const,
    humanPerceptualValidationPerformed: false as const,
    realPlaybackTransducerValidated: false as const,
    releaseGateEquivalent: false as const,
  };
  return { ...payload, manifestId: await contentDigest(payload) };
}

export async function verifySoftwareQualificationManifest(manifest: SoftwareQualificationManifestV1): Promise<boolean> {
  if (manifest.schemaVersion !== 1 || manifest.qualificationContractVersion !== "full-vision-software-manifest-1") return false;
  if (!isContentDigest(manifest.manifestId) || !/^[0-9a-f]{40}$/.test(manifest.sourceRevision)) return false;
  if (!Number.isFinite(Date.parse(manifest.createdAt)) || manifest.testRunIds.length === 0 || manifest.capabilityClaimIds.length === 0) return false;
  if (!manifest.testRunIds.every((id) => /^github-run:\d+$/.test(id))) return false;
  if (!manifest.capabilityClaimIds.every(isContentDigest)) return false;
  if (new Set(manifest.testRunIds).size !== manifest.testRunIds.length || new Set(manifest.capabilityClaimIds).size !== manifest.capabilityClaimIds.length) return false;
  if (manifest.physicalObjectTested !== false || manifest.humanPerceptualValidationPerformed !== false || manifest.realPlaybackTransducerValidated !== false || manifest.releaseGateEquivalent !== false) return false;
  const { manifestId, ...payload } = manifest;
  return manifestId === await contentDigest(payload);
}
