import type { EmpiricalCampaignV1 } from "./campaign";

export interface CandidateRegisterEntryV1 {
  readonly inventoryId: string;
  readonly label: string;
  readonly objectFamily: string;
  readonly material: string;
  readonly safetyStatus: "eligible" | "excluded";
  readonly supportDescription: string;
  readonly strikeLocationMarkable: boolean;
  readonly eligibleSlotIds: readonly string[];
  readonly exclusionReason: string | null;
}

export interface CandidateRegisterV1 {
  readonly schemaVersion: 1;
  readonly registerContractVersion: "candidate-register-1";
  readonly createdAt: string;
  readonly entries: readonly CandidateRegisterEntryV1[];
  readonly acousticAuditionPerformed: false;
}

export interface CampaignCollectionOrderEntryV1 {
  readonly ordinal: number;
  readonly specimenId: string;
  readonly cohort: "release-core" | "challenge";
  readonly orderingDigest: string;
}

export interface CampaignCollectionOrderV1 {
  readonly schemaVersion: 1;
  readonly orderContractVersion: "campaign-order-1";
  readonly campaignSignature: string;
  readonly entries: readonly CampaignCollectionOrderEntryV1[];
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function nonempty(value: string): boolean {
  return value.trim().length > 0;
}

export function validateCandidateRegister(register: CandidateRegisterV1): readonly string[] {
  const reasons: string[] = [];
  if (register.schemaVersion !== 1) reasons.push("candidate register schemaVersion must be 1");
  if (register.registerContractVersion !== "candidate-register-1") reasons.push("candidate register contract is invalid");
  if (!Number.isFinite(Date.parse(register.createdAt))) reasons.push("candidate register createdAt is invalid");
  if (register.acousticAuditionPerformed !== false) reasons.push("candidate register must be frozen before acoustic audition");
  if (register.entries.length === 0) reasons.push("candidate register must contain at least one entry");

  const seen = new Set<string>();
  for (const entry of register.entries) {
    const id = normalize(entry.inventoryId);
    if (!nonempty(id)) reasons.push("candidate inventoryId is missing");
    else if (seen.has(id)) reasons.push(`duplicate candidate inventoryId ${entry.inventoryId}`);
    else seen.add(id);
    if (!nonempty(entry.label)) reasons.push(`candidate ${entry.inventoryId} label is missing`);
    if (!nonempty(entry.objectFamily)) reasons.push(`candidate ${entry.inventoryId} objectFamily is missing`);
    if (!nonempty(entry.material)) reasons.push(`candidate ${entry.inventoryId} material is missing`);
    if (!nonempty(entry.supportDescription)) reasons.push(`candidate ${entry.inventoryId} support description is missing`);
    if (entry.safetyStatus === "excluded" && !nonempty(entry.exclusionReason ?? "")) {
      reasons.push(`excluded candidate ${entry.inventoryId} requires an exclusion reason`);
    }
    if (entry.safetyStatus === "eligible" && entry.exclusionReason !== null) {
      reasons.push(`eligible candidate ${entry.inventoryId} cannot have an exclusion reason`);
    }
    if (entry.safetyStatus === "eligible" && entry.eligibleSlotIds.length === 0) {
      reasons.push(`eligible candidate ${entry.inventoryId} requires at least one eligible slot`);
    }
  }
  return [...new Set(reasons)];
}

export function validateCampaignSelectionAgainstRegister(
  campaign: EmpiricalCampaignV1,
  register: CandidateRegisterV1,
): readonly string[] {
  const reasons = [...validateCandidateRegister(register)];
  const byInventory = new Map(register.entries.map((entry) => [normalize(entry.inventoryId), entry] as const));
  const selectedInventory = new Set<string>();
  const familyByCoreMaterial = new Map<string, Set<string>>();

  for (const specimen of campaign.specimens) {
    const separator = specimen.specimenId.indexOf("--");
    if (separator < 0) {
      reasons.push(`specimen ${specimen.specimenId} does not bind a slot to an inventory ID`);
      continue;
    }
    const slotId = specimen.specimenId.slice(0, separator);
    const inventoryId = normalize(specimen.specimenId.slice(separator + 2));
    const entry = byInventory.get(inventoryId);
    if (entry === undefined) {
      reasons.push(`specimen ${specimen.specimenId} references an inventory ID absent from the candidate register`);
      continue;
    }
    if (selectedInventory.has(inventoryId)) reasons.push(`inventory item ${entry.inventoryId} is assigned to more than one campaign slot`);
    selectedInventory.add(inventoryId);
    if (entry.safetyStatus !== "eligible") reasons.push(`selected inventory item ${entry.inventoryId} is excluded`);
    if (!entry.eligibleSlotIds.includes(slotId)) reasons.push(`inventory item ${entry.inventoryId} was not predeclared eligible for ${slotId}`);
    if (normalize(entry.objectFamily) !== normalize(specimen.objectFamily)) reasons.push(`object family mismatch for ${specimen.specimenId}`);
    if (normalize(entry.material) !== normalize(specimen.material)) reasons.push(`material mismatch for ${specimen.specimenId}`);

    if (specimen.cohort === "release-core") {
      const material = normalize(specimen.material);
      const families = familyByCoreMaterial.get(material) ?? new Set<string>();
      families.add(normalize(specimen.objectFamily));
      familyByCoreMaterial.set(material, families);
    }
  }

  for (const material of ["metal", "glass", "ceramic"]) {
    const families = familyByCoreMaterial.get(material);
    if (families !== undefined && families.size < 2) {
      reasons.push(`release-core ${material} specimens must come from two distinct object families`);
    }
  }
  return [...new Set(reasons)];
}

async function sha256Text(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function deriveCampaignCollectionOrder(
  campaign: EmpiricalCampaignV1,
  campaignSignature: string,
): Promise<CampaignCollectionOrderV1> {
  const releaseCore = campaign.specimens.filter((specimen) => specimen.cohort === "release-core");
  const challenge = campaign.specimens.filter((specimen) => specimen.cohort === "challenge");
  if (releaseCore.length !== challenge.length) {
    throw new Error("deterministic interleaving requires equal release-core and challenge cohort sizes");
  }
  const rank = async (specimens: typeof releaseCore) => {
    const values = await Promise.all(specimens.map(async (specimen) => ({
      specimen,
      digest: await sha256Text(`gate-a2-order-v1|${campaignSignature}|${specimen.specimenId}`),
    })));
    values.sort((left, right) => left.digest.localeCompare(right.digest));
    return values;
  };
  const [coreRanked, challengeRanked] = await Promise.all([rank(releaseCore), rank(challenge)]);
  const interleaved = coreRanked.flatMap((core, index) => [core, challengeRanked[index]!]);
  return {
    schemaVersion: 1,
    orderContractVersion: "campaign-order-1",
    campaignSignature,
    entries: interleaved.map((entry, index) => ({
      ordinal: index + 1,
      specimenId: entry.specimen.specimenId,
      cohort: entry.specimen.cohort,
      orderingDigest: `sha256:${entry.digest}`,
    })),
  };
}
