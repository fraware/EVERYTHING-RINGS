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

  const passing = sessions.filter((session) => session.passed);
  const distinctPassingSpecimens = new Set(
    passing.map((session) => normalizedIdentifier(session.specimenId)),
  );
  const materialCoverage = [...new Set(passing.map((session) => session.material))];
  const reasons = [...verdict.reasons];

  if (sessions.some((session) => currentBySession.get(session.sessionId) === false)) {
    pushUnique(
      reasons,
      `current release evidence must use fingerprint algorithm ${CURRENT_ACOUSTIC_FINGERPRINT_ALGORITHM_VERSION}`,
    );
  }
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

/** Builds the authoritative current-release verdict. Historical evidence remains parseable and can be evaluated explicitly with the lower-level evaluators. */
export function buildReleaseVerdict(
  evidence: readonly ValidationEvidenceV5[],
  gateBReviews: readonly GateBReview[],
  gateCReviews: readonly GateCReview[],
  createdAt: string,
): ReleaseVerdict {
  const gateA = enforceCurrentAlgorithm(evaluateGateARelease(evidence), evidence);
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
