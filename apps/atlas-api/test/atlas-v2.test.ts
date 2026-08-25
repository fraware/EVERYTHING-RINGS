import {
  contentDigest,
  createPublicObservationRecord,
  createSpecimenMembershipAssertion,
  createSpecimenRecord,
  verifyPublicObservationRecord,
  verifySpecimenMembershipAssertion,
  verifySpecimenRecord,
} from "@everything-rings/validation";
import { describe, expect, it } from "vitest";

describe("Atlas V2 observation contracts via atlas-api", () => {
  it("uses validation observation records without canonical object identity", async () => {
    const observation = await createPublicObservationRecord({
      createdAt: "2026-08-24T18:00:00.000Z",
      measurementId: await contentDigest({ m: 1 }),
      derivationIds: [],
      contributor: null,
      stationId: "digital-atlas-station",
      stationStatus: "unknown",
    });
    expect(await verifyPublicObservationRecord(observation)).toBe(true);
    expect(observation.canonicalObjectIdentity).toBeNull();
    expect("specimenId" in observation).toBe(false);
    expect(observation.rawMicrophoneSamplesIncluded).toBe(false);
  });

  it("keeps membership assertions versioned and assurance-labeled", async () => {
    const observation = await createPublicObservationRecord({
      createdAt: "2026-08-24T18:00:00.000Z",
      measurementId: await contentDigest({ m: 2 }),
      derivationIds: [],
      contributor: null,
      stationId: "digital-atlas-station",
      stationStatus: "unknown",
    });
    const specimen = await createSpecimenRecord({
      createdAt: "2026-08-24T18:01:00.000Z",
      specimenId: "registry-bell",
      grounding: "externally-grounded",
      displayLabel: "Registry bell",
      objectFamily: "bell",
      material: "other",
      publicDescription: null,
      identitySource: "external-registry",
    });
    const assertion = await createSpecimenMembershipAssertion({
      createdAt: "2026-08-24T18:02:00.000Z",
      observationRecordId: observation.observationRecordId,
      specimenRecordId: specimen.specimenRecordId,
      basis: "controlled-registry",
      assurance: "controlled-physical-registry",
      doesNotEstablish: ["acoustic similarity is not canonical identity", "this is not a physical-object proof"],
    });
    expect(await verifySpecimenRecord(specimen)).toBe(true);
    expect(await verifySpecimenMembershipAssertion(assertion)).toBe(true);
  });
});
