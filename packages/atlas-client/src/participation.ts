import { contentDigest } from "@everything-rings/validation";

/**
 * Pre-identity participation primitives. Collection membership means
 * "included in this collection", never "same physical object".
 * Challenge ranking must not treat identity or material inference as truth.
 */
export const COLLECTION_MEMBERSHIP_MEANING = "included-in-this-collection" as const;

export type ChallengeIntentV1 = "scientific" | "playful" | "both";

export type AtlasParticipationArtifactTypeV1 =
  | "public-observation"
  | "atlas-record"
  | "derivation-reference"
  | "acoustic-capsule";

export interface ChallengeConsentRulesV1 {
  readonly publicationRequired: boolean;
  readonly rawAudioAllowed: false;
  readonly canonicalObjectIdentityRequired: false;
  readonly locationConsentRequiredForGeographicAggregation: boolean;
}

export interface ChallengeDefinitionV1 {
  readonly schemaVersion: 1;
  readonly challengeContractVersion: "atlas-challenge-1";
  readonly challengeId: string;
  readonly challengeVersion: string;
  readonly prompt: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly allowedArtifactTypes: readonly AtlasParticipationArtifactTypeV1[];
  readonly consentRules: ChallengeConsentRulesV1;
  readonly rankingCriteria: string;
  readonly rankingUsesIdentityOrMaterialInferenceAsTruth: false;
  readonly collectionMembershipMeansSamePhysicalObject: false;
  readonly resultStatement: {
    readonly intent: ChallengeIntentV1;
    readonly statement: string;
  };
  readonly physicalProtocol: string | null;
}

export interface CollectionMembershipV1 {
  readonly schemaVersion: 1;
  readonly membershipContractVersion: "atlas-collection-membership-1";
  readonly collectionId: string;
  readonly memberId: string;
  readonly meaning: typeof COLLECTION_MEMBERSHIP_MEANING;
}

export interface ContributorSurfaceV1 {
  readonly schemaVersion: 1;
  readonly contributorContractVersion: "atlas-contributor-surface-1";
  readonly contributorId: string;
  readonly displayName: string | null;
  readonly publishedObservationIds: readonly string[];
  readonly collectionIds: readonly string[];
  readonly note: "Contributor identity is an account or handle, not specimen identity and not scientific provenance.";
}

function assertIso(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${field} is invalid`);
}

export async function createChallengeDefinition(
  input: Omit<
    ChallengeDefinitionV1,
    | "schemaVersion"
    | "challengeContractVersion"
    | "challengeId"
    | "rankingUsesIdentityOrMaterialInferenceAsTruth"
    | "collectionMembershipMeansSamePhysicalObject"
  >,
): Promise<ChallengeDefinitionV1> {
  if (input.challengeVersion.trim().length === 0) throw new Error("challengeVersion is required");
  if (input.prompt.trim().length === 0) throw new Error("challenge prompt is required");
  assertIso(input.startsAt, "startsAt");
  assertIso(input.endsAt, "endsAt");
  if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) throw new Error("challenge end must be after start");
  if (input.allowedArtifactTypes.length === 0) throw new Error("challenge requires allowed artifact types");
  if (input.rankingCriteria.trim().length === 0) throw new Error("ranking criteria are required");
  if (input.resultStatement.statement.trim().length === 0) throw new Error("scientific vs playful statement is required");
  if (input.consentRules.rawAudioAllowed !== false) throw new Error("challenges must remain PCM-free");
  if (input.consentRules.canonicalObjectIdentityRequired !== false) {
    throw new Error("challenges must not require canonical object identity");
  }
  const payload = {
    ...input,
    allowedArtifactTypes: [...input.allowedArtifactTypes],
    schemaVersion: 1 as const,
    challengeContractVersion: "atlas-challenge-1" as const,
    rankingUsesIdentityOrMaterialInferenceAsTruth: false as const,
    collectionMembershipMeansSamePhysicalObject: false as const,
  };
  return { ...payload, challengeId: await contentDigest(payload) };
}

export async function verifyChallengeDefinition(challenge: ChallengeDefinitionV1): Promise<boolean> {
  if (challenge.schemaVersion !== 1 || challenge.challengeContractVersion !== "atlas-challenge-1") return false;
  if (challenge.rankingUsesIdentityOrMaterialInferenceAsTruth !== false) return false;
  if (challenge.collectionMembershipMeansSamePhysicalObject !== false) return false;
  if (challenge.consentRules.rawAudioAllowed !== false) return false;
  if (challenge.consentRules.canonicalObjectIdentityRequired !== false) return false;
  const { challengeId, ...payload } = challenge;
  return challengeId === await contentDigest(payload);
}

export function createCollectionMembership(collectionId: string, memberId: string): CollectionMembershipV1 {
  if (collectionId.trim().length === 0 || memberId.trim().length === 0) {
    throw new Error("collection membership requires collectionId and memberId");
  }
  return {
    schemaVersion: 1,
    membershipContractVersion: "atlas-collection-membership-1",
    collectionId,
    memberId,
    meaning: COLLECTION_MEMBERSHIP_MEANING,
  };
}

export function createContributorSurface(
  input: Omit<ContributorSurfaceV1, "schemaVersion" | "contributorContractVersion" | "note">,
): ContributorSurfaceV1 {
  if (input.contributorId.trim().length === 0) throw new Error("contributorId is required");
  return {
    ...input,
    schemaVersion: 1,
    contributorContractVersion: "atlas-contributor-surface-1",
    note: "Contributor identity is an account or handle, not specimen identity and not scientific provenance.",
  };
}
