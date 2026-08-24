import { describe, expect, it } from "vitest";
import { ArtifactMigrationRegistryV1, createArtifactEnvelope, parseArtifactEnvelopeJson, verifyArtifactEnvelope } from "../src";

describe("versioned artifact transport", () => {
  it("detects payload tampering through content-addressed envelopes", async () => {
    const envelope = await createArtifactEnvelope("software-qualification", "qualification-1", { passed: true, checks: ["test", "build"] }, "2026-08-24T17:00:00.000Z");
    expect(await verifyArtifactEnvelope(envelope)).toBe(true);
    const parsed = await parseArtifactEnvelopeJson(JSON.stringify(envelope));
    expect(parsed.ok).toBe(true);
    const tampered = { ...envelope, payload: { passed: false, checks: ["test", "build"] } };
    expect(await verifyArtifactEnvelope(tampered)).toBe(false);
  });

  it("migrates explicit artifact versions without mutating the original payload", () => {
    const registry = new ArtifactMigrationRegistryV1();
    registry.register({ artifactKind: "atlas-record", fromContractVersion: "atlas-0", toContractVersion: "atlas-1", migrate: (payload) => ({ ...(payload as object), migrated: 1 }) });
    registry.register({ artifactKind: "atlas-record", fromContractVersion: "atlas-1", toContractVersion: "atlas-2", migrate: (payload) => ({ ...(payload as object), migrated: 2 }) });
    const original = { specimen: "a" };
    const migrated = registry.migrate("atlas-record", "atlas-0", "atlas-2", original) as { specimen: string; migrated: number };
    expect(migrated).toEqual({ specimen: "a", migrated: 2 });
    expect(original).toEqual({ specimen: "a" });
    expect(() => registry.migrate("measurement", "measurement-0", "measurement-1", {})).toThrow(/no migration path/);
  });
});
