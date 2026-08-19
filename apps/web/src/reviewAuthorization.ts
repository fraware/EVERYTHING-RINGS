import {
  evaluateGateASession,
  type ReviewTarget,
  type ValidationEvidenceV5,
} from "@everything-rings/validation";

export type ReviewAuthorizationResult =
  | { readonly ok: true; readonly target: ReviewTarget }
  | { readonly ok: false; readonly error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function exactReleaseContext(value: unknown, evidence: ValidationEvidenceV5): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError("release verdict must be an object");
  if (value.schemaVersion !== 1) throw new TypeError("release verdict schemaVersion must be 1");
  if (value.softwareRevision !== evidence.softwareRevision) {
    throw new TypeError("release verdict software revision does not match evidence");
  }
  const empiricalCampaign = value.empiricalCampaign;
  if (!isRecord(empiricalCampaign)) throw new TypeError("release verdict must include empirical campaign accounting");
  if (empiricalCampaign.authorizedSoftwareRevision !== evidence.softwareRevision) {
    throw new TypeError("campaign authorization does not match evidence revision");
  }
  const progress = empiricalCampaign.progress;
  if (!isRecord(progress) || progress.collectionComplete !== true) {
    throw new TypeError("empirical campaign accounting is not complete");
  }
  return value;
}

function exactGateATarget(release: Record<string, unknown>, evidence: ValidationEvidenceV5): ReviewTarget {
  const local = evaluateGateASession(evidence);
  if (!local.passed || local.reviewAttemptId === null) {
    throw new TypeError("evidence is not an eligible passing Gate A2 session");
  }
  const gateA = release.gateA;
  if (!isRecord(gateA) || gateA.passed !== true || !Array.isArray(gateA.sessions)) {
    throw new TypeError("canonical release verdict does not record Gate A2 PASS");
  }
  const session = gateA.sessions.find((candidate) => (
    isRecord(candidate)
    && candidate.sessionId === evidence.sessionId
    && typeof candidate.specimenId === "string"
    && normalized(candidate.specimenId) === normalized(evidence.object.specimenId)
  ));
  if (!isRecord(session) || session.passed !== true || session.reviewAttemptId !== local.reviewAttemptId) {
    throw new TypeError("evidence session is not the canonical Gate A2 review target");
  }
  return { sessionId: evidence.sessionId, attemptId: local.reviewAttemptId };
}

export function authorizeGateBReview(
  releaseVerdict: unknown,
  evidence: ValidationEvidenceV5,
): ReviewAuthorizationResult {
  try {
    const release = exactReleaseContext(releaseVerdict, evidence);
    return { ok: true, target: exactGateATarget(release, evidence) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function authorizeGateCReview(
  releaseVerdict: unknown,
  evidence: ValidationEvidenceV5,
): ReviewAuthorizationResult {
  try {
    const release = exactReleaseContext(releaseVerdict, evidence);
    const target = exactGateATarget(release, evidence);
    const gateB = release.gateB;
    if (!isRecord(gateB) || gateB.passed !== true || !Array.isArray(gateB.objects)) {
      throw new TypeError("canonical release verdict does not record Gate B PASS");
    }
    const object = gateB.objects.find((candidate) => (
      isRecord(candidate)
      && typeof candidate.specimenId === "string"
      && normalized(candidate.specimenId) === normalized(evidence.object.specimenId)
    ));
    if (!isRecord(object) || object.passed !== true || !isRecord(object.selectedTarget)) {
      throw new TypeError("specimen is not a passing Gate B object with one selected target");
    }
    if (
      object.selectedTarget.sessionId !== target.sessionId
      || object.selectedTarget.attemptId !== target.attemptId
    ) {
      throw new TypeError("Gate C target does not inherit the canonical Gate B target");
    }
    return { ok: true, target };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
