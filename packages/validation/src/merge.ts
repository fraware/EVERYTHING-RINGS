import type { GateBReview, GateCReview, ValidationEvidenceV5 } from "./types";

export type EvidenceMergeResult =
  | { readonly ok: true; readonly evidence: ValidationEvidenceV5 }
  | { readonly ok: false; readonly error: string };

function normalizedIdentifier(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function stableCore(evidence: ValidationEvidenceV5): string {
  return JSON.stringify({
    schemaVersion: evidence.schemaVersion,
    evidenceContractVersion: evidence.evidenceContractVersion,
    gateAContractVersion: evidence.gateAContractVersion,
    sessionId: evidence.sessionId,
    softwareRevision: evidence.softwareRevision,
    object: evidence.object,
    protocol: evidence.protocol,
    captureSettings: evidence.captureSettings,
    attemptCount: evidence.attemptCount,
    medianModalDriftCents: evidence.medianModalDriftCents,
    recurrence: evidence.recurrence,
    attempts: evidence.attempts,
    rawMicrophoneSamplesIncluded: evidence.rawMicrophoneSamplesIncluded,
  });
}

function logicalReviewKey(review: GateBReview | GateCReview): string {
  const reviewer = normalizedIdentifier(review.reviewerId);
  const target = `${review.sessionId}\u0000${review.attemptId}`;
  if ("deviceId" in review) {
    return `C\u0000${reviewer}\u0000${normalizedIdentifier(review.deviceId)}\u0000${target}`;
  }
  return `B\u0000${reviewer}\u0000${target}`;
}

function mergeReviews<T extends GateBReview | GateCReview>(
  left: readonly T[],
  right: readonly T[],
): { readonly ok: true; readonly reviews: readonly T[] } | { readonly ok: false; readonly error: string } {
  const byId = new Map<string, T>();
  const byLogicalIdentity = new Map<string, T>();
  for (const review of [...left, ...right]) {
    const id = review.reviewId.trim();
    const serialized = JSON.stringify(review);
    const existingId = byId.get(id);
    if (existingId !== undefined && JSON.stringify(existingId) !== serialized) {
      return { ok: false, error: `review ID ${id} has conflicting contents` };
    }

    const logicalKey = logicalReviewKey(review);
    const existingLogical = byLogicalIdentity.get(logicalKey);
    if (existingLogical !== undefined && JSON.stringify(existingLogical) !== serialized) {
      return { ok: false, error: "one reviewer/device target has multiple conflicting submissions" };
    }

    if (existingId === undefined) byId.set(id, review);
    if (existingLogical === undefined) byLogicalIdentity.set(logicalKey, review);
  }
  return { ok: true, reviews: [...byId.values()] };
}

export function mergeValidationEvidence(
  existing: ValidationEvidenceV5,
  incoming: ValidationEvidenceV5,
): EvidenceMergeResult {
  if (existing.sessionId !== incoming.sessionId) {
    return { ok: false, error: "cannot merge different session IDs" };
  }
  if (stableCore(existing) !== stableCore(incoming)) {
    return { ok: false, error: "same session ID has different measurement evidence" };
  }

  const gateB = mergeReviews(existing.gateBReviews, incoming.gateBReviews);
  if (!gateB.ok) return gateB;
  const gateC = mergeReviews(existing.gateCReviews, incoming.gateCReviews);
  if (!gateC.ok) return gateC;

  const incomingIsNewer = Date.parse(incoming.createdAt) >= Date.parse(existing.createdAt);
  const newer = incomingIsNewer ? incoming : existing;
  return {
    ok: true,
    evidence: {
      ...newer,
      gateBReviews: gateB.reviews,
      gateCReviews: gateC.reviews,
    },
  };
}
