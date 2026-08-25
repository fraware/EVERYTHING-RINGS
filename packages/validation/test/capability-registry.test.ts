import { describe, expect, it } from "vitest";
import {
  assertPhysicalClaimMaturityTransition,
  createCapabilityRegistryEntry,
  createOfficialSoftwareCapabilityRegistry,
  physicalClaimNextMaturity,
  verifyCapabilityRegistry,
  verifyCapabilityRegistryEntry,
  CAPABILITY_MATURITY_LADDER,
  CAPABILITY_REGISTRY_IDS,
} from "../src";

const REVISION = "0123456789abcdef0123456789abcdef01234567";

describe("capability-claim registry", () => {
  it("publishes software-only Twin and Atlas claims with physicalObjectTested false", async () => {
    const registry = await createOfficialSoftwareCapabilityRegistry();
    expect(registry.registryContractVersion).toBe("capability-registry-1");
    expect(await verifyCapabilityRegistry(registry)).toBe(true);
    expect(registry.entries.map((entry) => entry.capability).sort()).toEqual([...CAPABILITY_REGISTRY_IDS].sort());
    for (const entry of registry.entries) {
      expect(entry.physicalObjectTested).toBe(false);
      expect(entry.physicalClaim).toBe(false);
      expect(entry.maturity).toBe("software-qualified");
      expect(entry.doesNotEstablish.length).toBeGreaterThan(0);
      expect(await verifyCapabilityRegistryEntry(entry)).toBe(true);
    }
  });

  it("encodes the maturity ladder and refuses skipping software-qualified to released for a physical claim", () => {
    expect([...CAPABILITY_MATURITY_LADDER]).toEqual([
      "prototype",
      "software-qualified",
      "synthetic-qualified",
      "physical-research",
      "held-out-validated",
      "product-eligible",
      "released",
    ]);
    expect(physicalClaimNextMaturity("software-qualified")).toBe("synthetic-qualified");
    expect(() => assertPhysicalClaimMaturityTransition("software-qualified", "released")).toThrow(/cannot skip from software-qualified to released/);
  });

  it("rejects creating a released physical claim that skipped held-out validation", async () => {
    await expect(createCapabilityRegistryEntry({
      createdAt: "2026-08-25T00:00:00.000Z",
      capability: "twin-verification",
      proposition: "Physical same-object verification is released.",
      capabilityVersion: "twin-verification-physical-1",
      population: "unnamed physical population",
      exclusions: ["universal identity"],
      evidenceDomain: "physical",
      evidence: [{ evidenceId: REVISION, domain: "physical", description: "insufficient physical bundle" }],
      doesNotEstablish: ["universal identity"],
      maturity: "released",
      priorMaturity: "software-qualified",
      physicalClaim: true,
      physicalObjectTested: true,
      reviewState: "independently-reviewed",
      reviewerIsImplementer: false,
    })).rejects.toThrow(/cannot skip from software-qualified to released/);
  });
});
