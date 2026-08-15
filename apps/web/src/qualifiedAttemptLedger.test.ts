import type { CaptureQuality } from "@everything-rings/acquisition";
import { describe, expect, it } from "vitest";
import {
  beginQualifiedAttempt,
  clearQualifiedAttemptLedger,
  createQualifiedAttemptLedger,
  interruptQualifiedAttempt,
  settleQualifiedAttempt,
} from "./qualifiedAttemptLedger";

const QUALITY: CaptureQuality = {
  score: 0.9,
  snrDb: 30,
  clippedFraction: 0,
  peakAmplitude: 0.5,
  secondaryTransientRatio: 0.1,
};

function success(frequencyHz = 440) {
  return {
    status: "success" as const,
    fingerprint: {
      version: 1 as const,
      algorithmVersion: "er-dsp-1" as const,
      sampleRate: 48000,
      durationSeconds: 2,
      modes: [frequencyHz, frequencyHz * 2, frequencyHz * 3].map((frequency, index) => ({
        frequencyHz: frequency,
        relativeAmplitude: 1 / (index + 1),
        decaySeconds: 0.5,
        q: 100,
        confidence: 0.9,
        diagnostics: {
          prominenceDb: 20,
          persistenceSeconds: 0.2,
          frequencyStdCents: 2,
          decayFitScore: 0.95,
          observationCount: 12,
        },
      })),
    },
  };
}

describe("qualified attempt ledger", () => {
  it("creates exactly one immutable attempt from one qualified acquisition", () => {
    let ledger = beginQualifiedAttempt(createQualifiedAttemptLedger(), "1", QUALITY, 5);
    const settled = settleQualifiedAttempt(ledger, "1", success());
    expect(settled.settled).toBe(true);
    ledger = settled.ledger;
    expect(ledger.pending).toBeUndefined();
    expect(ledger.attempts).toHaveLength(1);
    expect(ledger.attempts[0]?.id).toBe(1);

    const duplicate = settleQualifiedAttempt(ledger, "1", success(880));
    expect(duplicate.settled).toBe(false);
    expect(duplicate.ledger.attempts).toEqual(ledger.attempts);
  });

  it("ignores stale worker results from an earlier request", () => {
    const ledger = beginQualifiedAttempt(createQualifiedAttemptLedger(), "current", QUALITY, 5);
    const stale = settleQualifiedAttempt(ledger, "stale", success());
    expect(stale.settled).toBe(false);
    expect(stale.ledger.pending?.requestId).toBe("current");
    expect(stale.ledger.attempts).toHaveLength(0);
  });

  it("turns interruption after qualification into a retained analytical failure", () => {
    const ledger = beginQualifiedAttempt(createQualifiedAttemptLedger(), "1", QUALITY, 5);
    const interrupted = interruptQualifiedAttempt(ledger);
    expect(interrupted.settled).toBe(true);
    expect(interrupted.ledger.attempts).toHaveLength(1);
    expect(interrupted.ledger.attempts[0]?.analysis).toEqual({
      status: "failure",
      reason: "ANALYSIS_INTERNAL_ERROR",
    });
  });

  it("does not create an attempt when nothing qualified is pending", () => {
    const ledger = createQualifiedAttemptLedger();
    const interrupted = interruptQualifiedAttempt(ledger);
    expect(interrupted.settled).toBe(false);
    expect(interrupted.ledger.attempts).toHaveLength(0);
  });

  it("refuses concurrent qualified analyses", () => {
    const ledger = beginQualifiedAttempt(createQualifiedAttemptLedger(), "1", QUALITY, 5);
    expect(() => beginQualifiedAttempt(ledger, "2", QUALITY, 5)).toThrow(/already awaiting analysis/);
  });

  it("enforces a hard five-attempt cap independently of the UI", () => {
    let ledger = createQualifiedAttemptLedger();
    for (let index = 1; index <= 5; index += 1) {
      ledger = beginQualifiedAttempt(ledger, String(index), QUALITY, 5);
      ledger = settleQualifiedAttempt(ledger, String(index), success(400 + index)).ledger;
    }
    expect(ledger.attempts).toHaveLength(5);
    expect(() => beginQualifiedAttempt(ledger, "6", QUALITY, 5)).toThrow(/limit of 5/);
  });

  it("preserves a failed slot and cannot overwrite it with a later success", () => {
    let ledger = beginQualifiedAttempt(createQualifiedAttemptLedger(), "1", QUALITY, 5);
    ledger = settleQualifiedAttempt(
      ledger,
      "1",
      { status: "failure", reason: "NO_STABLE_RESONANCES" },
    ).ledger;
    ledger = beginQualifiedAttempt(ledger, "2", QUALITY, 5);
    ledger = settleQualifiedAttempt(ledger, "2", success()).ledger;

    expect(ledger.attempts[0]?.analysis.status).toBe("failure");
    expect(ledger.attempts[1]?.analysis.status).toBe("success");
    expect(ledger.attempts.map((attempt) => attempt.id)).toEqual([1, 2]);
  });

  it("clears only when an explicit new session ledger is created", () => {
    let ledger = beginQualifiedAttempt(createQualifiedAttemptLedger(), "1", QUALITY, 5);
    ledger = settleQualifiedAttempt(ledger, "1", success()).ledger;
    const cleared = clearQualifiedAttemptLedger();
    expect(ledger.attempts).toHaveLength(1);
    expect(cleared.attempts).toHaveLength(0);
  });
});
