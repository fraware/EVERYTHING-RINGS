import type {
  EmpiricalCampaignSpecimen,
  EmpiricalCampaignV1,
  FixedSetupProtocol,
  MaterialClass,
  ValidationObjectMetadata,
} from "@everything-rings/validation";

export interface CampaignBoundSetup {
  readonly object: ValidationObjectMetadata;
  readonly protocol: FixedSetupProtocol;
  readonly cohort: EmpiricalCampaignSpecimen["cohort"];
  readonly objectFamily: string;
  readonly targetSessions: number;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function findCampaignSpecimen(
  campaign: EmpiricalCampaignV1,
  specimenId: string,
): EmpiricalCampaignSpecimen | undefined {
  const identifier = normalized(specimenId);
  if (identifier.length === 0) return undefined;
  return campaign.specimens.find((specimen) => normalized(specimen.specimenId) === identifier);
}

export function setupFromCampaignSpecimen(specimen: EmpiricalCampaignSpecimen): CampaignBoundSetup {
  return {
    object: {
      specimenId: specimen.specimenId,
      label: specimen.label,
      material: specimen.material as MaterialClass,
    },
    protocol: {
      fixedSetup: true,
      microphoneDistanceCm: specimen.protocol.microphoneDistanceCm,
      striker: specimen.protocol.striker,
      strikeLocation: specimen.protocol.strikeLocation,
      supportCondition: specimen.protocol.supportCondition,
    },
    cohort: specimen.cohort,
    objectFamily: specimen.objectFamily,
    targetSessions: specimen.targetSessions,
  };
}

export function campaignRevisionMatches(
  campaign: EmpiricalCampaignV1 | undefined,
  softwareRevision: string,
): boolean {
  if (campaign === undefined) return true;
  return campaign.authorizedSoftwareRevision === softwareRevision;
}

export function campaignSelectionCanArm(
  campaign: EmpiricalCampaignV1 | undefined,
  selectedSpecimenId: string,
  softwareRevision: string,
): boolean {
  if (campaign === undefined) return true;
  return campaignRevisionMatches(campaign, softwareRevision)
    && findCampaignSpecimen(campaign, selectedSpecimenId) !== undefined;
}
