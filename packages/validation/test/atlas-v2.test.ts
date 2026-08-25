import { describe, expect, it } from "vitest";
import {
  createPublicObservationRecord,
  createSpecimenMembershipAssertion,
  createSpecimenRecord,
  verifyPublicObservationRecord,
  verifySpecimenMembershipAssertion,
  verifySpecimenRecord,
  ATLAS_ASSURANCE_LEVELS_V2,
} from "../src";

const MEASUREMENT = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("Atlas V2 observation/specimen/assertion contracts", () => {
  it("publishes a capture without canonical object identity", async () => {
    const observation = await createPublicObservationRecord({
      createdAt: "2026-08-25T00:00:00.000Z",
      measurementId: MEASUREMENT,
      derivationIds: [],
      contributor: { contributorId: "synth-contributor", displayName: "Synth" },
      stationId: "synth-station-a",
      stationStatus: "unknown",
    });
    expect(observation.observationContractVersion).toBe("public-observation-record-2");
    expect(observation.canonicalObjectIdentity).toBeNull();
    expect(observation.rawMicrophoneSamplesIncluded).toBe(false);
    expect("specimenId" in observation).toBe(false);
    expect(await verifyPublicObservationRecord(observation)).toBe(true);
  });

  it("separates specimen records from observations and versions membership assurance", async () => {
    const observation = await createPublicObservationRecord({
      createdAt: "2026-08-25T00:00:00.000Z",
      measurementId: MEASUREMENT,
      derivationIds: ["sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
      contributor: null,
      stationId: "synth-station-a",
      stationStatus: "unqualified",
    });
    const specimen = await createSpecimenRecord({
      createdAt: "2026-08-25T00:00:00.000Z",
      specimenId: "synth-bowl-001",
      grounding: "externally-grounded",
      displayLabel: "Synthetic brass bowl",
      objectFamily: "bowl",
      material: "metal",
      publicDescription: null,
      identitySource: "external-registry",
    });
    const assertion = await createSpecimenMembershipAssertion({
      createdAt: "2026-08-25T00:00:00.000Z",
      observationRecordId: observation.observationRecordId,
      specimenRecordId: specimen.specimenRecordId,
      basis: "controlled-registry",
      assurance: "controlled-physical-registry",
      doesNotEstablish: ["er1-* equality is not same-object identity", "acoustic similarity is not canonical identity"],
    });
    expect(specimen.specimenContractVersion).toBe("specimen-record-2");
    expect(assertion.membershipAssertionContractVersion).toBe("specimen-membership-assertion-2");
    expect([...ATLAS_ASSURANCE_LEVELS_V2]).toEqual([
      "self-declared",
      "controlled-physical-registry",
      "calibrated-sonic-twin-supported",
      "independently-reviewed",
    ]);
    expect(await verifySpecimenRecord(specimen)).toBe(true);
    expect(await verifySpecimenMembershipAssertion(assertion)).toBe(true);
    expect(await verifyPublicObservationRecord({ ...observation, canonicalObjectIdentity: "er1-same" as unknown as null })).toBe(false);
  });

  it("refuses membership asserted from er1 equality", async () => {
    await expect(createSpecimenMembershipAssertion({
      createdAt: "2026-08-25T00:00:00.000Z",
      observationRecordId: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      specimenRecordId: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      basis: "er1-signature" as "contributor-declaration",
      assurance: "self-declared",
      doesNotEstablish: ["not a physical identity proof"],
    })).rejects.toThrow(/er1-\*/);
  });
});
