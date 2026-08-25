import { describe, expect, it } from "vitest";
import {
  createCapabilityClaim,
  createSoftwareQualificationManifest,
  verifyCapabilityClaim,
  verifySoftwareQualificationManifest,
} from "../src";

const REVISION = "0123456789abcdef0123456789abcdef01234567";

describe("machine-readable assurance", () => {
  it("binds a software-qualified proposition to explicit evidence and exclusions", async () => {
    const claim = await createCapabilityClaim({
      createdAt: "2026-08-24T16:00:00.000Z",
      capability: "sonic-twin-retrieval",
      proposition: "The deterministic retrieval implementation ranks the correct digital specimen first in the named software qualification corpus.",
      scope: "built-in digital qualification corpus only",
      exclusions: ["physical-object identity", "material identity", "human perceptual validity"],
      evidence: [{ evidenceId: REVISION, domain: "software", description: "exact source revision" }],
      maturity: "software-qualified",
    });
    expect(await verifyCapabilityClaim(claim)).toBe(true);
    expect(await verifyCapabilityClaim({ ...claim, proposition: "mutated" })).toBe(false);
  });

  it("creates and verifies a non-empirical qualification manifest with non-empty claim coverage", async () => {
    const claim = await createCapabilityClaim({
      createdAt: "2026-08-24T16:00:00.000Z",
      capability: "atlas-integrity",
      proposition: "Content-addressed Atlas artifacts detect mutation in software tests.",
      scope: "software qualification",
      exclusions: ["physical provenance truth"],
      evidence: [{ evidenceId: "github-run:12345", domain: "software", description: "qualification workflow" }],
      maturity: "software-qualified",
    });
    const manifest = await createSoftwareQualificationManifest({
      sourceRevision: REVISION,
      createdAt: "2026-08-24T16:05:00.000Z",
      testRunIds: ["github-run:12345"],
      capabilityClaimIds: [claim.claimId],
    });
    expect(await verifySoftwareQualificationManifest(manifest)).toBe(true);
    expect(manifest.physicalObjectTested).toBe(false);
    expect(manifest.releaseGateEquivalent).toBe(false);
    expect(await verifySoftwareQualificationManifest({ ...manifest, sourceRevision: "f".repeat(40) })).toBe(false);
  });

  it("refuses qualification manifests without explicit capability claims", async () => {
    await expect(createSoftwareQualificationManifest({
      sourceRevision: REVISION,
      createdAt: "2026-08-24T16:05:00.000Z",
      testRunIds: ["github-run:12345"],
      capabilityClaimIds: [],
    })).rejects.toThrow(/capability claim/);
  });
});
