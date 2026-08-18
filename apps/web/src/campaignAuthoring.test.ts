import { describe, expect, it } from "vitest";
import {
  buildEmpiricalCampaignFromDraft,
  createRecommendedCampaignDraft,
  RECOMMENDED_CAMPAIGN_SLOTS,
} from "./campaignAuthoring";

const REVISION = "0123456789abcdef0123456789abcdef01234567";

function completedDraft() {
  const draft = createRecommendedCampaignDraft(REVISION);
  return {
    ...draft,
    specimens: draft.specimens.map((specimen, index) => ({
      ...specimen,
      specimenId: `specimen-${index + 1}`,
      label: `physical object ${index + 1}`,
      objectFamily: `family-${index + 1}`,
      strikeLocation: "marked point",
      supportCondition: "documented fixed support",
    })),
  };
}

describe("campaign authoring", () => {
  it("starts from the frozen 12-slot release-core and challenge design", () => {
    expect(RECOMMENDED_CAMPAIGN_SLOTS).toHaveLength(12);
    expect(RECOMMENDED_CAMPAIGN_SLOTS.filter((slot) => slot.cohort === "release-core")).toHaveLength(6);
    expect(RECOMMENDED_CAMPAIGN_SLOTS.filter((slot) => slot.cohort === "challenge")).toHaveLength(6);
    expect(RECOMMENDED_CAMPAIGN_SLOTS.slice(0, 6).map((slot) => slot.suggestedMaterial)).toEqual([
      "metal", "metal", "glass", "glass", "ceramic", "ceramic",
    ]);
  });

  it("prefills only protocol constants that are intentionally standardized", () => {
    const draft = createRecommendedCampaignDraft(REVISION);
    expect(draft.specimens.every((specimen) => specimen.microphoneDistanceCm === 20)).toBe(true);
    expect(draft.specimens.every((specimen) => specimen.striker === "wooden dowel")).toBe(true);
    expect(draft.specimens.every((specimen) => specimen.specimenId === "")).toBe(true);
    expect(draft.specimens.every((specimen) => specimen.label === "")).toBe(true);
    expect(draft.specimens.every((specimen) => specimen.strikeLocation === "")).toBe(true);
    expect(draft.specimens.every((specimen) => specimen.supportCondition === "")).toBe(true);
  });

  it("refuses to export placeholders or duplicate physical specimen IDs", () => {
    const incomplete = buildEmpiricalCampaignFromDraft(createRecommendedCampaignDraft(REVISION), "2026-08-18T09:00:00.000Z");
    expect(incomplete.ok).toBe(false);
    if (!incomplete.ok) expect(incomplete.errors.some((error) => error.includes("specimen ID is required"))).toBe(true);

    const complete = completedDraft();
    const duplicate = {
      ...complete,
      specimens: complete.specimens.map((specimen, index) => index === 1 ? { ...specimen, specimenId: " SPECIMEN-1 " } : specimen),
    };
    const result = buildEmpiricalCampaignFromDraft(duplicate, "2026-08-18T09:00:00.000Z");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((error) => error.includes("duplicate specimen ID"))).toBe(true);
  });

  it("does not allow the frozen release-core material allocation or slot design to drift", () => {
    const complete = completedDraft();
    const changedMaterial = {
      ...complete,
      specimens: complete.specimens.map((specimen, index) => index === 0 ? { ...specimen, material: "wood" as const } : specimen),
    };
    const materialResult = buildEmpiricalCampaignFromDraft(changedMaterial, "2026-08-18T09:00:00.000Z");
    expect(materialResult.ok).toBe(false);
    if (!materialResult.ok) expect(materialResult.errors).toContain("slot 1 (core-metal-1): release-core material must remain metal");

    const missingSlot = { ...complete, specimens: complete.specimens.slice(0, -1) };
    const slotResult = buildEmpiricalCampaignFromDraft(missingSlot, "2026-08-18T09:00:00.000Z");
    expect(slotResult.ok).toBe(false);
    if (!slotResult.ok) expect(slotResult.errors).toContain("recommended campaign must contain exactly 12 frozen slots");
  });

  it("builds a parser-valid manifest only after every physical field is specified", () => {
    const result = buildEmpiricalCampaignFromDraft(completedDraft(), "2026-08-18T09:00:00.000Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.campaign.specimens).toHaveLength(12);
    expect(result.campaign.authorizedSoftwareRevision).toBe(REVISION);
    expect(result.campaign.specimens.slice(0, 6).map((specimen) => specimen.material)).toEqual([
      "metal", "metal", "glass", "glass", "ceramic", "ceramic",
    ]);
    expect(result.campaign.specimens[0]?.protocol).toEqual({
      fixedSetup: true,
      microphoneDistanceCm: 20,
      striker: "wooden dowel",
      strikeLocation: "marked point",
      supportCondition: "documented fixed support",
    });
  });
});
