import { describe, expect, it } from "vitest";
import {
  buildReleaseVerdict,
  buildReleaseVerdictForRevision,
} from "../src";
import { fiveObjects, SOFTWARE_REVISION } from "./helpers";

const OTHER_REVISION = "fedcba9876543210fedcba9876543210fedcba98";

describe("current release collection revision policy", () => {
  it("passes current Gate A evidence only when it matches the authorized collection revision", () => {
    const verdict = buildReleaseVerdictForRevision(
      fiveObjects(),
      [],
      [],
      "2026-08-15T18:00:00.000Z",
      SOFTWARE_REVISION,
    );
    expect(verdict.gateA.passed).toBe(true);
    expect(verdict.gateA.passingSessionCount).toBe(5);
  });

  it("rejects a uniform er-dsp-2 batch from a different software revision", () => {
    const stale = fiveObjects().map((bundle) => ({ ...bundle, softwareRevision: OTHER_REVISION }));
    expect(buildReleaseVerdict(stale, [], [], "2026-08-15T18:00:00.000Z").gateA.passed).toBe(true);

    const verdict = buildReleaseVerdictForRevision(
      stale,
      [],
      [],
      "2026-08-15T18:00:00.000Z",
      SOFTWARE_REVISION,
    );
    expect(verdict.gateA.passed).toBe(false);
    expect(verdict.gateA.passingSessionCount).toBe(0);
    expect(verdict.gateA.distinctPassingSpecimenCount).toBe(0);
    expect(verdict.gateA.sessions.every((session) => session.reviewAttemptId === null)).toBe(true);
    expect(verdict.gateA.reasons).toContain(
      `current release evidence must use software revision ${SOFTWARE_REVISION}`,
    );
    expect(verdict.releaseReady).toBe(false);
  });

  it("fails closed when the authorized collection revision is missing or malformed", () => {
    for (const expected of ["", "deadbeef", "G".repeat(40)]) {
      const verdict = buildReleaseVerdictForRevision(
        fiveObjects(),
        [],
        [],
        "2026-08-15T18:00:00.000Z",
        expected,
      );
      expect(verdict.gateA.passed).toBe(false);
      expect(verdict.gateA.passingSessionCount).toBe(0);
      expect(verdict.gateA.reasons).toContain("authorized collection software revision is invalid or unset");
    }
  });
});
