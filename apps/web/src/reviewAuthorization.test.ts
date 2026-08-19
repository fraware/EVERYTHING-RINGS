import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import type { ValidationEvidenceV5 } from "@everything-rings/validation";
import { describe, expect, it } from "vitest";
import { authorizeGateBReview, authorizeGateCReview } from "./reviewAuthorization";

const FINGERPRINT: AcousticFingerprintV1 = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48_000,
  durationSeconds: 1,
  modes: [
    { frequencyHz: 440, relativeAmplitude: 1, decaySeconds: 0.8, q: 1100, confidence: 0.96, diagnostics: { prominenceDb: 24, persistenceSeconds: 0.7, frequencyStdCents: 2, decayFitScore: 0.95, observationCount: 18 } },
    { frequencyHz: 880, relativeAmplitude: 0.6, decaySeconds: 0.6, q: 1600, confidence: 0.93, diagnostics: { prominenceDb: 21, persistenceSeconds: 0.5, frequencyStdCents: 2, decayFitScore: 0.93, observationCount: 16 } },
    { frequencyHz: 1320, relativeAmplitude: 0.4, decaySeconds: 0.45, q: 1800, confidence: 0.9, diagnostics: { prominenceDb: 18, persistenceSeconds: 0.4, frequencyStdCents: 3, decayFitScore: 0.9, observationCount: 14 } },
  ],
};

function evidence(): ValidationEvidenceV5 {
  return {
    schemaVersion: 5,
    evidenceContractVersion: "validation-evidence-5",
    gateAContractVersion: "gate-a-2",
    sessionId: "session-01",
    createdAt: "2026-08-19T00:00:00.000Z",
    softwareRevision: "b".repeat(40),
    object: { specimenId: "core-metal-1--inv-003", label: "metal bowl", material: "metal" },
    protocol: { fixedSetup: true, microphoneDistanceCm: 20, striker: "wooden dowel", strikeLocation: "rim A", supportCondition: "three felt points" },
    captureSettings: { sampleRate: 48_000 },
    realtimeAudioTiming: null,
    attemptCount: 5,
    medianModalDriftCents: 0,
    recurrence: [],
    attempts: Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      quality: { score: 1, snrDb: 30, clippedFraction: 0, peakAmplitude: 0.2, secondaryTransientRatio: 0.1 },
      analysis: { status: "success" as const, fingerprint: FINGERPRINT },
    })),
    gateBReviews: [],
    gateCReviews: [],
    rawMicrophoneSamplesIncluded: false,
  };
}

function release() {
  const source = evidence();
  return {
    schemaVersion: 1,
    softwareRevision: source.softwareRevision,
    empiricalCampaign: {
      authorizedSoftwareRevision: source.softwareRevision,
      progress: { collectionComplete: true },
    },
    gateA: {
      passed: true,
      sessions: [{
        sessionId: source.sessionId,
        specimenId: source.object.specimenId,
        passed: true,
        reviewAttemptId: 5,
      }],
    },
    gateB: {
      passed: true,
      objects: [{
        specimenId: source.object.specimenId,
        passed: true,
        selectedTarget: { sessionId: source.sessionId, attemptId: 5 },
      }],
    },
  };
}

describe("post-collection review authorization", () => {
  it("authorizes Gate B only from a complete canonical Gate A2 PASS", () => {
    const result = authorizeGateBReview(release(), evidence());
    expect(result).toEqual({ ok: true, target: { sessionId: "session-01", attemptId: 5 } });

    const incomplete = release();
    incomplete.empiricalCampaign.progress.collectionComplete = false;
    expect(authorizeGateBReview(incomplete, evidence()).ok).toBe(false);
  });

  it("rejects Gate B evidence absent from the canonical Gate A session set", () => {
    const verdict = release();
    verdict.gateA.sessions[0]!.sessionId = "another-session";
    const result = authorizeGateBReview(verdict, evidence());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("canonical Gate A2 review target");
  });

  it("authorizes Gate C only after Gate B PASS with exact target inheritance", () => {
    const result = authorizeGateCReview(release(), evidence());
    expect(result).toEqual({ ok: true, target: { sessionId: "session-01", attemptId: 5 } });

    const openGateB = release();
    openGateB.gateB.passed = false;
    expect(authorizeGateCReview(openGateB, evidence()).ok).toBe(false);
  });

  it("rejects Gate C target substitution", () => {
    const verdict = release();
    verdict.gateB.objects[0]!.selectedTarget.attemptId = 4;
    const result = authorizeGateCReview(verdict, evidence());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("does not inherit");
  });
});
