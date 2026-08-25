import { describe, expect, it } from "vitest";
import { createMeasurementSourceLink, verifyMeasurementSourceLink } from "../src";

describe("measurement source-link", () => {
  it("binds original filename, exact source bytes, and conversion-tool revision without migrating evidence", async () => {
    const link = await createMeasurementSourceLink({
      measurementId: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      originalFilename: "synth-noncampaign-bowl.json",
      sourceByteDigest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      sourceContractVersion: "synthetic-source-1",
      sourceRevision: "0123456789abcdef0123456789abcdef01234567",
      conversionToolRevision: "89abcdef0123456789abcdef0123456789abcdef",
      createdAt: "2026-08-25T00:00:00.000Z",
    });
    expect(link.sourceLinkContractVersion).toBe("measurement-source-link-1");
    expect(await verifyMeasurementSourceLink(link)).toBe(true);
    expect(await verifyMeasurementSourceLink({ ...link, originalFilename: "mutated.json" })).toBe(false);
  });

  it("rejects path-shaped filenames so the link cannot be used as a live v8 migration handle", async () => {
    await expect(createMeasurementSourceLink({
      measurementId: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      originalFilename: "../evidence/v8.json",
      sourceByteDigest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      sourceContractVersion: "validation-evidence-5",
      sourceRevision: "0123456789abcdef0123456789abcdef01234567",
      conversionToolRevision: "89abcdef0123456789abcdef0123456789abcdef",
      createdAt: "2026-08-25T00:00:00.000Z",
    })).rejects.toThrow(/basename/);
  });
});
