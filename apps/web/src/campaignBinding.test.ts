import type { EmpiricalCampaignV1 } from "@everything-rings/validation";
import { describe, expect, it } from "vitest";
import {
  campaignRevisionMatches,
  campaignSelectionCanArm,
  findCampaignSpecimen,
  setupFromCampaignSpecimen,
} from "./campaignBinding";

const REVISION = "0123456789abcdef0123456789abcdef01234567";

const CAMPAIGN: EmpiricalCampaignV1 = {
  schemaVersion: 1,
  campaignContractVersion: "empirical-campaign-1",
  campaignId: "physical-campaign-001",
  createdAt: "2026-08-18T08:00:00.000Z",
  authorizedSoftwareRevision: REVISION,
  specimens: [{
    specimenId: "Metal-Bell-01",
    label: "small brass bell",
    material: "metal",
    cohort: "release-core",
    objectFamily: "bell",
    targetSessions: 1,
    protocol: {
      fixedSetup: true,
      microphoneDistanceCm: 20,
      striker: "wooden dowel",
      strikeLocation: "marked rim point",
      supportCondition: "suspended at handle",
    },
  }],
};

describe("campaign-bound lab setup", () => {
  it("resolves precommitted specimen IDs canonically", () => {
    expect(findCampaignSpecimen(CAMPAIGN, " metal-bell-01 ")?.label).toBe("small brass bell");
    expect(findCampaignSpecimen(CAMPAIGN, "missing")).toBeUndefined();
  });

  it("copies the exact precommitted identity and fixed setup", () => {
    const specimen = CAMPAIGN.specimens[0]!;
    const setup = setupFromCampaignSpecimen(specimen);
    expect(setup.object).toEqual({
      specimenId: "Metal-Bell-01",
      label: "small brass bell",
      material: "metal",
    });
    expect(setup.protocol).toEqual(specimen.protocol);
    expect(setup.cohort).toBe("release-core");
    expect(setup.objectFamily).toBe("bell");
    expect(setup.targetSessions).toBe(1);
  });

  it("blocks campaign collection under the wrong software revision", () => {
    expect(campaignRevisionMatches(CAMPAIGN, REVISION)).toBe(true);
    expect(campaignRevisionMatches(CAMPAIGN, "f".repeat(40))).toBe(false);
    expect(campaignSelectionCanArm(CAMPAIGN, "Metal-Bell-01", REVISION)).toBe(true);
    expect(campaignSelectionCanArm(CAMPAIGN, "Metal-Bell-01", "f".repeat(40))).toBe(false);
  });

  it("requires an actual planned specimen when a campaign is loaded", () => {
    expect(campaignSelectionCanArm(CAMPAIGN, "", REVISION)).toBe(false);
    expect(campaignSelectionCanArm(CAMPAIGN, "unplanned", REVISION)).toBe(false);
    expect(campaignSelectionCanArm(undefined, "", REVISION)).toBe(true);
  });
});
