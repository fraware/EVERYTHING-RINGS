import type { GateBReview, GateCReview, ValidationEvidenceV3 } from "./types";

export type EvidenceMergeResult =
  | { readonly ok: true; readonly evidence: ValidationEvidenceV3 }
  | { readonly ok: false; readonly error: string };

function stableCore(evidence: ValidationEvidenceV3): string {
  return JSON.stringify({
    schemaVersion: evidence.schemaVersion,
    evidenceContractVersion: evidence.evidenceContractVersion,
    gateAContractVersion: evidence.gateAContractVersion,
    sessionId: evidence.sessionId,
    object: evidence.object,
    protocol: evidence.protocol,
    captureSettings: evidence.captureSettings,
    recordCount: evidence.recordCount,
    medianModalDriftCents: evidence.medianModalDriftCents,
    recurrence: evidence.recurrence,
    records: evidence.records,
    rawMicrophoneSamplesIncluded: evidence.rawMicrophoneSamplesIncluded,
  });
}

function mergeReviews<T extends GateBReview | GateCReview>(
  left: readonly T[],
  right: readonly T[],
): { readonly ok: true; readonly reviews: readonly T[] } | { readonly ok: false; readonly error: string } {
  const byId = new Map<string, T>();
  for (const review of [...left, ...right]) {
    const key = review.reviewId.trim();
    const existing = byId.get(key);
    if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(review)) {
      return { ok: false, error: `review ID ${key} has conflicting contents` };
    }
    if (existing === undefined) byId.set(key, review);
  }
  return { ok: true, reviews: [...byId.values()] };
}

export function mergeValidationEvidence(
  existing: ValidationEvidenceV3,
  incoming: ValidationEvidenceV3,
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
