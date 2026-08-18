import {
  parseEmpiricalCampaign,
  type EmpiricalCampaignCohort,
  type EmpiricalCampaignV1,
  type FixedSetupProtocol,
  type MaterialClass,
} from "@everything-rings/validation";

export interface CampaignAuthoringSlot {
  readonly slotId: string;
  readonly cohort: EmpiricalCampaignCohort;
  readonly suggestedMaterial: MaterialClass;
  readonly selectionCriterion: string;
}

export interface CampaignAuthoringSpecimen {
  readonly slotId: string;
  readonly specimenId: string;
  readonly label: string;
  readonly material: MaterialClass;
  readonly cohort: EmpiricalCampaignCohort;
  readonly objectFamily: string;
  readonly targetSessions: number;
  readonly microphoneDistanceCm: number;
  readonly striker: string;
  readonly strikeLocation: string;
  readonly supportCondition: string;
}

export interface CampaignAuthoringDraft {
  readonly campaignId: string;
  readonly authorizedSoftwareRevision: string;
  readonly specimens: readonly CampaignAuthoringSpecimen[];
}

export type CampaignAuthoringResult =
  | { readonly ok: true; readonly campaign: EmpiricalCampaignV1 }
  | { readonly ok: false; readonly errors: readonly string[] };

export const RECOMMENDED_CAMPAIGN_SLOTS: readonly CampaignAuthoringSlot[] = [
  { slotId: "core-metal-1", cohort: "release-core", suggestedMaterial: "metal", selectionCriterion: "ordinary metal object; first distinct object family" },
  { slotId: "core-metal-2", cohort: "release-core", suggestedMaterial: "metal", selectionCriterion: "ordinary metal object; different family from core-metal-1" },
  { slotId: "core-glass-1", cohort: "release-core", suggestedMaterial: "glass", selectionCriterion: "ordinary glass object; first distinct object family" },
  { slotId: "core-glass-2", cohort: "release-core", suggestedMaterial: "glass", selectionCriterion: "ordinary glass object; different family from core-glass-1" },
  { slotId: "core-ceramic-1", cohort: "release-core", suggestedMaterial: "ceramic", selectionCriterion: "ordinary ceramic object; first distinct object family" },
  { slotId: "core-ceramic-2", cohort: "release-core", suggestedMaterial: "ceramic", selectionCriterion: "ordinary ceramic object; different family from core-ceramic-1" },
  { slotId: "challenge-short-decay", cohort: "challenge", suggestedMaterial: "wood", selectionCriterion: "strongly damped object with short audible decay" },
  { slotId: "challenge-broad", cohort: "challenge", suggestedMaterial: "plastic", selectionCriterion: "weak or broad resonant structure" },
  { slotId: "challenge-coupled", cohort: "challenge", suggestedMaterial: "composite", selectionCriterion: "heterogeneous or coupled multi-part object" },
  { slotId: "challenge-high-q", cohort: "challenge", suggestedMaterial: "glass", selectionCriterion: "high-Q object with long decay or closely spaced peaks" },
  { slotId: "challenge-low-snr", cohort: "challenge", suggestedMaterial: "other", selectionCriterion: "small or weakly radiating object near the microphone/SNR floor" },
  { slotId: "challenge-degenerate", cohort: "challenge", suggestedMaterial: "other", selectionCriterion: "geometry likely to produce near-degenerate or strike-location-sensitive modes" },
] as const;

export function createRecommendedCampaignDraft(
  authorizedSoftwareRevision: string,
  campaignId = "physical-campaign-001",
): CampaignAuthoringDraft {
  return {
    campaignId,
    authorizedSoftwareRevision,
    specimens: RECOMMENDED_CAMPAIGN_SLOTS.map((slot) => ({
      slotId: slot.slotId,
      specimenId: "",
      label: "",
      material: slot.suggestedMaterial,
      cohort: slot.cohort,
      objectFamily: "",
      targetSessions: 1,
      microphoneDistanceCm: 20,
      striker: "wooden dowel",
      strikeLocation: "",
      supportCondition: "",
    })),
  };
}

function nonempty(value: string): boolean {
  return value.trim().length > 0;
}

function protocolFromDraft(specimen: CampaignAuthoringSpecimen): FixedSetupProtocol {
  return {
    fixedSetup: true,
    microphoneDistanceCm: specimen.microphoneDistanceCm,
    striker: specimen.striker.trim(),
    strikeLocation: specimen.strikeLocation.trim(),
    supportCondition: specimen.supportCondition.trim(),
  };
}

export function buildEmpiricalCampaignFromDraft(
  draft: CampaignAuthoringDraft,
  createdAt: string,
): CampaignAuthoringResult {
  const errors: string[] = [];
  if (!nonempty(draft.campaignId)) errors.push("campaign ID is required");
  if (!/^[0-9a-f]{40}$/.test(draft.authorizedSoftwareRevision)) {
    errors.push("authorized software revision must be an exact 40-hex Git revision");
  }
  if (!Number.isFinite(Date.parse(createdAt))) errors.push("createdAt must be an ISO-compatible timestamp");
  if (draft.specimens.length !== RECOMMENDED_CAMPAIGN_SLOTS.length) {
    errors.push(`recommended campaign must contain exactly ${RECOMMENDED_CAMPAIGN_SLOTS.length} frozen slots`);
  }

  const seen = new Set<string>();
  draft.specimens.forEach((specimen, index) => {
    const expectedSlot = RECOMMENDED_CAMPAIGN_SLOTS[index];
    const field = `slot ${index + 1} (${specimen.slotId})`;
    if (expectedSlot === undefined) {
      errors.push(`${field}: slot is outside the recommended campaign design`);
    } else {
      if (specimen.slotId !== expectedSlot.slotId) {
        errors.push(`${field}: expected frozen slot ${expectedSlot.slotId}`);
      }
      if (specimen.cohort !== expectedSlot.cohort) {
        errors.push(`${field}: cohort must remain ${expectedSlot.cohort}`);
      }
      if (expectedSlot.cohort === "release-core" && specimen.material !== expectedSlot.suggestedMaterial) {
        errors.push(`${field}: release-core material must remain ${expectedSlot.suggestedMaterial}`);
      }
    }
    if (!nonempty(specimen.specimenId)) errors.push(`${field}: specimen ID is required`);
    if (!nonempty(specimen.label)) errors.push(`${field}: object label is required`);
    if (!nonempty(specimen.objectFamily)) errors.push(`${field}: object family is required`);
    if (!(specimen.microphoneDistanceCm > 0) || !Number.isFinite(specimen.microphoneDistanceCm)) {
      errors.push(`${field}: microphone distance must be finite and positive`);
    }
    if (!nonempty(specimen.striker)) errors.push(`${field}: striker is required`);
    if (!nonempty(specimen.strikeLocation)) errors.push(`${field}: strike location is required`);
    if (!nonempty(specimen.supportCondition)) errors.push(`${field}: support condition is required`);
    if (!Number.isInteger(specimen.targetSessions) || specimen.targetSessions <= 0) {
      errors.push(`${field}: target sessions must be a positive integer`);
    }
    const normalized = specimen.specimenId.trim().toLocaleLowerCase("en-US");
    if (normalized.length > 0) {
      if (seen.has(normalized)) errors.push(`${field}: duplicate specimen ID ${specimen.specimenId.trim()}`);
      seen.add(normalized);
    }
  });

  if (errors.length > 0) return { ok: false, errors };

  const candidate: EmpiricalCampaignV1 = {
    schemaVersion: 1,
    campaignContractVersion: "empirical-campaign-1",
    campaignId: draft.campaignId.trim(),
    createdAt,
    authorizedSoftwareRevision: draft.authorizedSoftwareRevision,
    specimens: draft.specimens.map((specimen) => ({
      specimenId: specimen.specimenId.trim(),
      label: specimen.label.trim(),
      material: specimen.material,
      cohort: specimen.cohort,
      objectFamily: specimen.objectFamily.trim(),
      targetSessions: specimen.targetSessions,
      protocol: protocolFromDraft(specimen),
    })),
  };
  const parsed = parseEmpiricalCampaign(candidate);
  if (!parsed.ok) return { ok: false, errors: [parsed.error] };
  return { ok: true, campaign: parsed.campaign };
}
