import { describe, expect, it } from "vitest";
import {
  deriveCampaignCollectionOrder,
  empiricalCampaignSignature,
  validateCampaignSelectionAgainstRegister,
  validateCandidateRegister,
  type CandidateRegisterV1,
  type EmpiricalCampaignV1,
} from "../src";
import { SOFTWARE_REVISION } from "./helpers";

function campaign(): EmpiricalCampaignV1 {
  const core = [
    ["core-metal-1", "inv-001", "metal", "bell"],
    ["core-metal-2", "inv-002", "metal", "bowl"],
    ["core-glass-1", "inv-003", "glass", "glass"],
    ["core-glass-2", "inv-004", "glass", "bottle"],
    ["core-ceramic-1", "inv-005", "ceramic", "mug"],
    ["core-ceramic-2", "inv-006", "ceramic", "plate"],
  ] as const;
  const challenge = [
    ["challenge-short-decay", "inv-007", "wood", "block"],
    ["challenge-broad", "inv-008", "plastic", "container"],
    ["challenge-coupled", "inv-009", "composite", "assembly"],
    ["challenge-high-q", "inv-010", "glass", "vessel"],
    ["challenge-low-snr", "inv-011", "other", "small-object"],
    ["challenge-degenerate", "inv-012", "other", "symmetric-object"],
  ] as const;
  return {
    schemaVersion: 1,
    campaignContractVersion: "empirical-campaign-1",
    campaignId: "digital-precommitment-test",
    createdAt: "2026-08-24T12:00:00.000Z",
    authorizedSoftwareRevision: SOFTWARE_REVISION,
    specimens: [
      ...core.map(([slot, inventory, material, family]) => ({
        specimenId: `${slot}--${inventory}`,
        label: inventory,
        material,
        cohort: "release-core" as const,
        objectFamily: family,
        targetSessions: 1,
        protocol: { fixedSetup: true as const, microphoneDistanceCm: 20, striker: "wooden dowel", strikeLocation: "mark", supportCondition: "fixed" },
      })),
      ...challenge.map(([slot, inventory, material, family]) => ({
        specimenId: `${slot}--${inventory}`,
        label: inventory,
        material,
        cohort: "challenge" as const,
        objectFamily: family,
        targetSessions: 1,
        protocol: { fixedSetup: true as const, microphoneDistanceCm: 20, striker: "wooden dowel", strikeLocation: "mark", supportCondition: "fixed" },
      })),
    ],
  };
}

function register(): CandidateRegisterV1 {
  return {
    schemaVersion: 1,
    registerContractVersion: "candidate-register-1",
    createdAt: "2026-08-24T11:00:00.000Z",
    acousticAuditionPerformed: false,
    entries: campaign().specimens.map((specimen) => {
      const separator = specimen.specimenId.indexOf("--");
      const slot = specimen.specimenId.slice(0, separator);
      const inventory = specimen.specimenId.slice(separator + 2);
      return {
        inventoryId: inventory,
        label: specimen.label,
        objectFamily: specimen.objectFamily,
        material: specimen.material,
        safetyStatus: "eligible" as const,
        supportDescription: "safe fixed support",
        strikeLocationMarkable: true,
        eligibleSlotIds: [slot],
        exclusionReason: null,
      };
    }),
  };
}

describe("physical precommitment artifacts", () => {
  it("validates a non-acoustic candidate register and its campaign bindings", () => {
    const candidates = register();
    expect(validateCandidateRegister(candidates)).toEqual([]);
    expect(validateCampaignSelectionAgainstRegister(campaign(), candidates)).toEqual([]);
  });

  it("rejects reuse of one physical inventory item", () => {
    const value = campaign();
    const mutated: EmpiricalCampaignV1 = {
      ...value,
      specimens: value.specimens.map((specimen, index) => index === 1
        ? { ...specimen, specimenId: "core-metal-2--inv-001", objectFamily: "bell" }
        : specimen),
    };
    expect(validateCampaignSelectionAgainstRegister(mutated, register()).join("\n")).toMatch(/more than one campaign slot|not predeclared eligible/);
  });

  it("derives a stable 12-entry release-core/challenge interleaving", async () => {
    const value = campaign();
    const signature = empiricalCampaignSignature(value);
    const first = await deriveCampaignCollectionOrder(value, signature);
    const second = await deriveCampaignCollectionOrder(value, signature);
    expect(first).toEqual(second);
    expect(first.entries).toHaveLength(12);
    expect(first.entries.map((entry) => entry.cohort)).toEqual(Array.from({ length: 12 }, (_, index) => index % 2 === 0 ? "release-core" : "challenge"));
    expect(new Set(first.entries.map((entry) => entry.specimenId)).size).toBe(12);
    expect(first.entries.every((entry) => /^sha256:[0-9a-f]{64}$/.test(entry.orderingDigest))).toBe(true);
  });
});
