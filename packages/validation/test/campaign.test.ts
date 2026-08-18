import { describe, expect, it } from "vitest";
import {
  empiricalCampaignSignature,
  evaluateEmpiricalCampaign,
  parseEmpiricalCampaign,
  type EmpiricalCampaignSpecimen,
  type EmpiricalCampaignV1,
} from "../src";
import { evidence, SOFTWARE_REVISION } from "./helpers";

const PROTOCOL = {
  fixedSetup: true as const,
  microphoneDistanceCm: 20,
  striker: "wooden dowel",
  strikeLocation: "rim mark",
  supportCondition: "held at base",
};

function specimen(
  specimenId: string,
  label: string,
  material: EmpiricalCampaignSpecimen["material"],
  cohort: EmpiricalCampaignSpecimen["cohort"] = "release-core",
): EmpiricalCampaignSpecimen {
  return {
    specimenId,
    label,
    material,
    cohort,
    objectFamily: label,
    targetSessions: 1,
    protocol: PROTOCOL,
  };
}

function campaign(specimens: readonly EmpiricalCampaignSpecimen[]): EmpiricalCampaignV1 {
  return {
    schemaVersion: 1,
    campaignContractVersion: "empirical-campaign-1",
    campaignId: "campaign-2026-08",
    createdAt: "2026-08-18T08:00:00.000Z",
    authorizedSoftwareRevision: SOFTWARE_REVISION,
    specimens,
  };
}

describe("empirical campaign contract", () => {
  it("produces a stable specimen-order-independent campaign signature", () => {
    const left = campaign([
      specimen("specimen-bell", "bell", "metal"),
      specimen("specimen-glass", "wine glass", "glass"),
    ]);
    const right = campaign([...left.specimens].reverse());
    expect(empiricalCampaignSignature(left)).toBe(empiricalCampaignSignature(right));
    expect(empiricalCampaignSignature(left)).toMatch(/^erc1-[0-9a-f]{16}$/);
  });

  it("rejects duplicate specimen identities and invalid collection revisions", () => {
    const duplicate = campaign([
      specimen("Specimen-1", "bell", "metal"),
      specimen(" specimen-1 ", "bowl", "metal"),
    ]);
    expect(parseEmpiricalCampaign(duplicate)).toEqual({ ok: false, error: "duplicate specimenId specimen-1" });

    expect(parseEmpiricalCampaign({ ...campaign([specimen("s1", "bell", "metal")]), authorizedSoftwareRevision: "main" })).toEqual({
      ok: false,
      error: "authorizedSoftwareRevision must be an exact 40-hex Git revision",
    });
  });

  it("treats a precommitted analytical failure as collected instead of allowing it to disappear", () => {
    const manifest = campaign([
      specimen("specimen-bell", "bell", "metal"),
      specimen("specimen-glass", "wine glass", "glass", "challenge"),
    ]);
    const progress = evaluateEmpiricalCampaign(manifest, [
      evidence("bell", "metal", { specimenId: "specimen-bell" }),
      evidence("wine glass", "glass", { specimenId: "specimen-glass", failureAttemptIds: [3] }),
    ]);

    expect(progress.collectionComplete).toBe(true);
    expect(progress.conformingCompleteSessionCount).toBe(2);
    expect(progress.passingSessionCount).toBe(1);
    expect(progress.analyticalFailureCount).toBe(1);
    expect(progress.specimens[1]?.complete).toBe(true);
    expect(progress.specimens[1]?.passingSessionCount).toBe(0);
  });

  it("keeps missing, unplanned, overcollected, and setup-mismatched specimens visible", () => {
    const manifest = campaign([
      specimen("specimen-bell", "bell", "metal"),
      specimen("specimen-glass", "wine glass", "glass"),
    ]);
    const bell = evidence("bell", "metal", { specimenId: "specimen-bell", sessionId: "bell-1" });
    const secondBell = evidence("bell", "metal", { specimenId: "specimen-bell", sessionId: "bell-2" });
    const unplanned = evidence("ceramic mug", "ceramic", { specimenId: "specimen-mug" });
    const progress = evaluateEmpiricalCampaign(manifest, [bell, secondBell, unplanned]);

    expect(progress.collectionComplete).toBe(false);
    expect(progress.unplannedSpecimenIds).toEqual(["specimen-mug"]);
    expect(progress.specimens[0]?.reasons).toContain("more sessions were collected than precommitted");
    expect(progress.specimens[1]?.reasons).toContain("no session collected");
  });

  it("requires the precommitted fixed setup exactly", () => {
    const manifest = campaign([specimen("specimen-bell", "bell", "metal")]);
    const bundle = evidence("bell", "metal", { specimenId: "specimen-bell" });
    const changed = {
      ...bundle,
      protocol: { ...bundle.protocol, microphoneDistanceCm: 30 },
    };
    const progress = evaluateEmpiricalCampaign(manifest, [changed]);
    expect(progress.collectionComplete).toBe(false);
    expect(progress.specimens[0]?.conformingCompleteSessionCount).toBe(0);
    expect(progress.specimens[0]?.reasons).toContain("fixed setup differs from the precommitted protocol");
  });
});
