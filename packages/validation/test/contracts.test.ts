import { describe, expect, it } from "vitest";
import { evaluateGateASession, mergeValidationEvidence } from "../src";
import { evidence, gateBReview, fingerprint } from "./helpers";

describe("Gate A2 capture quality", () => {
  it("requires all five retained qualified attempts to satisfy the frozen acquisition bounds", () => {
    const valid = evidence("bell", "metal");
    expect(evaluateGateASession(valid).passed).toBe(true);

    const attempts = valid.attempts.map((attempt, index) => index === 2
      ? { ...attempt, quality: { ...attempt.quality, snrDb: 11.99 } }
      : attempt);
    const verdict = evaluateGateASession({ ...valid, attempts });
    expect(verdict.passed).toBe(false);
    expect(verdict.metrics.qualityPassingAttempts).toBe(4);
    expect(verdict.reasons.some((reason) => reason.includes("acquisition-quality"))).toBe(true);
  });

  it("accepts values exactly on the frozen quality boundaries", () => {
    const valid = evidence("bell", "metal");
    const attempts = valid.attempts.map((attempt) => ({
      ...attempt,
      quality: {
        ...attempt.quality,
        peakAmplitude: 0.02,
        snrDb: 12,
        clippedFraction: 0.001,
        secondaryTransientRatio: 0.65,
      },
    }));
    expect(evaluateGateASession({ ...valid, attempts }).passed).toBe(true);
  });
});

describe("v4 evidence session merging", () => {
  it("merges additional reviews only when the immutable qualified-attempt core matches", () => {
    const first = evidence("bell", "metal");
    const second = {
      ...first,
      createdAt: "2026-08-15T12:05:00.000Z",
      gateBReviews: [gateBReview("bell", "r1", { reviewId: "review-1" })],
    };
    const merged = mergeValidationEvidence(first, second);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.evidence.gateBReviews).toHaveLength(1);
    expect(merged.evidence.createdAt).toBe(second.createdAt);
  });

  it("rejects reuse of a session ID with different qualified-attempt evidence", () => {
    const first = evidence("bell", "metal");
    const attempts = first.attempts.map((attempt, index) => index === 4 && attempt.analysis.status === "success"
      ? { ...attempt, analysis: { status: "success" as const, fingerprint: fingerprint(20) } }
      : attempt);
    const second = { ...first, attempts };
    const merged = mergeValidationEvidence(first, second);
    expect(merged.ok).toBe(false);
    if (!merged.ok) expect(merged.error).toContain("different measurement evidence");
  });

  it("rejects a changed analytical failure outcome under the same session ID", () => {
    const first = evidence("bell", "metal", { failureAttemptIds: [3] });
    const second = evidence("bell", "metal", { sessionId: first.sessionId });
    const merged = mergeValidationEvidence(first, second);
    expect(merged.ok).toBe(false);
    if (!merged.ok) expect(merged.error).toContain("different measurement evidence");
  });

  it("rejects one review ID reused with conflicting contents", () => {
    const first = { ...evidence("bell", "metal"), gateBReviews: [gateBReview("bell", "r1", { reviewId: "same" })] };
    const second = {
      ...evidence("bell", "metal"),
      gateBReviews: [gateBReview("bell", "r1", { reviewId: "same", identity: 1 })],
    };
    const merged = mergeValidationEvidence(first, second);
    expect(merged.ok).toBe(false);
    if (!merged.ok) expect(merged.error).toContain("conflicting contents");
  });

  it("rejects a second logical submission from the same normalized reviewer and target", () => {
    const first = {
      ...evidence("bell", "metal"),
      gateBReviews: [gateBReview("bell", "Reviewer-1", { reviewId: "first" })],
    };
    const second = {
      ...evidence("bell", "metal"),
      gateBReviews: [gateBReview("bell", "reviewer-1", { reviewId: "second", identity: 3 })],
    };
    const merged = mergeValidationEvidence(first, second);
    expect(merged.ok).toBe(false);
    if (!merged.ok) expect(merged.error).toContain("multiple conflicting submissions");
  });
});
