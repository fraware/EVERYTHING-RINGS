import { CURRENT_ACOUSTIC_FINGERPRINT_ALGORITHM_VERSION } from "@everything-rings/dsp";
import {
  DEFAULT_GATE_A_THRESHOLDS,
  evaluateGateARelease,
  evaluateGateBRelease,
  evaluateGateCRelease,
} from "./evaluate";
import type {
  GateAReleaseVerdict,
  GateBReview,
  GateCReview,
  ReleaseVerdict,
  ValidationEvidenceV5,
} from "./types";

const SOFTWARE_REVISION_PATTERN = /^[0-9a-f]{40}$/;

function normalizedIdentifier(identifier: string): string {
  return identifier.trim().toLocaleLowerCase("en-US");
}

function bundleUsesCurrentAlgorithm(evidence: ValidationEvidenceV5): boolean {
  return evidence.attempts.every((attempt) => (
    attempt.analysis.status !== "success"
    || attempt.analysis.fingerprint.algorithmVersion === CURRENT_ACOUSTIC_FINGERPRINT_ALGORITHM_VERSION
  ));
}

function pushUnique(reasons: string[], reason: string): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function recomputeGateA(
  verdict: GateAReleaseVerdict,
  sessions: GateAReleaseVerdict["sessions"],
  additionalReasons: readonly string[],
): GateAReleaseVerdict {
  const passing = sessions.filter((session) => session.passed);
  const distinctPassingSpecimens = new Set(
    passing.map((session) => normalizedIdentifier(session.specimenId)),
  );
  const materialCoverage = [...new Set(passing.map((session) => session.material))];
  const reasons = [...verdict.reasons];
  for (const reason of additionalReasons) pushUnique(reasons, reason);

  if (distinctPassingSpecimens.size < DEFAULT_GATE_A_THRESHOLDS.minimumDistinctSpecimens) {
    pushUnique(
      reasons,
      `requires ${DEFAULT_GATE_A_THRESHOLDS.minimumDistinctSpecimens} distinct passing physical specimens`,
    );
  }
  for (const material of DEFAULT_GATE_A_THRESHOLDS.requiredMaterials) {
    if (!materialCoverage.includes(material)) pushUnique(reasons, `missing passing ${material} specimen`);
  }

  return {
    ...verdict,
    passed: reasons.length === 0,
    passingSessionCount: passing.length,
    distinctPassingSpecimenCount: distinctPassingSpecimens.size,
    materialCoverage,
    sessions,
    reasons,
  };
}

function enforceCurrentAlgorithm(
  verdict: GateAReleaseVerdict,
  evidence: readonly ValidationEvidenceV5[],
): GateAReleaseVerdict {
  const currentBySession = new Map(
    evidence.map((bundle) => [bundle.sessionId, bundleUsesCurrentAlgorithm(bundle)] as const),
  );

  const sessions = verdict.sessions.map((session) => {
    const current = currentBySession.get(session.sessionId) ?? false;
    if (current) return session;
    return {
      ...session,
      passed: false,
      reviewAttemptId: null,
      reasons: [
        ...session.reasons,
        `current release requires fingerprint algorithm ${CURRENT_ACOUSTIC_FINGERPRINT_ALGORITHM_VERSION}`,
      ],
    };
  });

  const additionalReasons = sessions.some((session) => currentBySession.get(session.sessionId) === false)
    ? [`current release evidence must use fingerprint algorithm ${CURRENT_ACOUSTIC_FINGERPRINT_ALGORITHM_VERSION}`]
    : [];
  return recomputeGateA(verdict, sessions, additionalReasons);
}

function enforceExpectedRevision(
  verdict: GateAReleaseVerdict,
  expectedSoftwareRevision: string,
): GateAReleaseVerdict {
  const expected = expectedSoftwareRevision.trim();
  if (!SOFTWARE_REVISION_PATTERN.test(expected)) {
    const sessions = verdict.sessions.map((session) => ({
      ...session,
      passed: false,
      reviewAttemptId: null,
      reasons: [...session.reasons, "authorized collection software revision is invalid or unset"],
    }));
    return recomputeGateA(
      verdict,
      sessions,
      ["authorized collection software revision is invalid or unset"],
    );
  }

  const sessions = verdict.sessions.map((session) => {
    if (session.softwareRevision === expected) return session;
    return {
      ...session,
      passed: false,
      reviewAttemptId: null,
      reasons: [
        ...session.reasons,
        `current release requires software revision ${expected}`,
      ],
    };
  });
  const mismatched = sessions.some((session) => session.softwareRevision !== expected);
  return recomputeGateA(
    verdict,
    sessions,
    mismatched ? [`current release evidence must use software revision ${expected}`] : [],
  );
}

function buildFromGateA(
  gateA: GateAReleaseVerdict,
  gateBReviews: readonly GateBReview[],
  gateCReviews: readonly GateCReview[],
  createdAt: string,
): ReleaseVerdict {
  const gateB = evaluateGateBRelease(gateA, gateBReviews);
  const gateC = evaluateGateCRelease(gateB, gateCReviews);
  return {
    schemaVersion: 1,
    createdAt,
    softwareRevision: gateA.softwareRevision,
    gateA,
    gateB,
    gateC,
    releaseReady: gateA.passed && gateB.passed && gateC.passed,
  };
}

/**
 * Evaluates evidence under the current fingerprint algorithm policy without binding
 * it to one externally authorized collection revision. Use the lower-level Gate A
 * evaluators for historical algorithms and buildReleaseVerdictForRevision for an
 * authoritative collection/release decision.
 */
export function buildReleaseVerdict(
  evidence: readonly ValidationEvidenceV5[],
  gateBReviews: readonly GateBReview[],
  gateCReviews: readonly GateCReview[],
  createdAt: string,
): ReleaseVerdict {
  const gateA = enforceCurrentAlgorithm(evaluateGateARelease(evidence), evidence);
  return buildFromGateA(gateA, gateBReviews, gateCReviews, createdAt);
}

/** Builds the authoritative current-release verdict for one exact collection software revision. */
export function buildReleaseVerdictForRevision(
  evidence: readonly ValidationEvidenceV5[],
  gateBReviews: readonly GateBReview[],
  gateCReviews: readonly GateCReview[],
  createdAt: string,
  expectedSoftwareRevision: string,
): ReleaseVerdict {
  const algorithmBound = enforceCurrentAlgorithm(evaluateGateARelease(evidence), evidence);
  const gateA = enforceExpectedRevision(algorithmBound, expectedSoftwareRevision);
  return buildFromGateA(gateA, gateBReviews, gateCReviews, createdAt);
}
