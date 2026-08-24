import { describe, expect, it } from "vitest";
import { parseGateBPlan, parseGateCPlan } from "../src";
import { SOFTWARE_REVISION } from "./helpers";

const DIGEST = `sha256:${"0".repeat(64)}`;
const targets = Array.from({ length: 5 }, (_, index) => ({
  specimenId: `specimen-${index + 1}`,
  objectLabel: `object ${index + 1}`,
  sessionId: `session-${index + 1}`,
  attemptId: 5,
}));

describe("canonical review plan parsers", () => {
  it("accepts exactly five distinct Gate B targets, two reviewers, and an upstream verdict digest", () => {
    const result = parseGateBPlan({
      schemaVersion: 1,
      planContractVersion: "gate-b-plan-1",
      gateARevision: SOFTWARE_REVISION,
      gateAVerdictSha256: DIGEST,
      reviewerIds: ["reviewer-a", "reviewer-b"],
      targets,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects duplicate Gate B specimens and non-exact matrix size", () => {
    const result = parseGateBPlan({
      schemaVersion: 1,
      planContractVersion: "gate-b-plan-1",
      gateARevision: SOFTWARE_REVISION,
      gateAVerdictSha256: DIGEST,
      reviewerIds: ["reviewer-a", "reviewer-b"],
      targets: [...targets.slice(0, 4), { ...targets[4], specimenId: targets[0]?.specimenId }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/distinct/);
  });

  it("accepts exactly four Gate C targets, two reviewers, and two devices including mobile", () => {
    const result = parseGateCPlan({
      schemaVersion: 1,
      planContractVersion: "gate-c-plan-1",
      gateBVerdictSha256: DIGEST,
      reviewerIds: ["reviewer-c", "reviewer-d"],
      devices: [
        { deviceId: "desktop-1", deviceClass: "desktop" },
        { deviceId: "phone-1", deviceClass: "mobile" },
      ],
      targets: targets.slice(0, 4),
    });
    expect(result.ok).toBe(true);
  });

  it("rejects Gate C plans without a mobile device", () => {
    const result = parseGateCPlan({
      schemaVersion: 1,
      planContractVersion: "gate-c-plan-1",
      gateBVerdictSha256: DIGEST,
      reviewerIds: ["reviewer-c", "reviewer-d"],
      devices: [
        { deviceId: "desktop-1", deviceClass: "desktop" },
        { deviceId: "desktop-2", deviceClass: "desktop" },
      ],
      targets: targets.slice(0, 4),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/mobile/);
  });

  it("rejects missing or malformed upstream verdict digests", () => {
    const result = parseGateBPlan({
      schemaVersion: 1,
      planContractVersion: "gate-b-plan-1",
      gateARevision: SOFTWARE_REVISION,
      gateAVerdictSha256: "not-a-digest",
      reviewerIds: ["reviewer-a", "reviewer-b"],
      targets,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/sha256/);
  });
});
