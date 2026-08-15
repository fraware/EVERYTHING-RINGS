import { isAcousticFingerprintAlgorithmVersion } from "@everything-rings/dsp";
import { deriveEvidenceRecurrence, medianFinite } from "./derive";
import type {
  GateAReleaseVerdict,
  GateASessionVerdict,
  GateAThresholds,
  GateBObjectVerdict,
  GateBReleaseVerdict,
  GateBReview,
  GateBThresholds,
  GateCObjectVerdict,
  GateCReleaseVerdict,
  GateCReview,
  GateCThresholds,
  MaterialClass,
  ReleaseVerdict,
  ReviewTarget,
  ValidationEvidenceAttempt,
  ValidationEvidenceV5,
} from "./types";

export const DEFAULT_GATE_A_THRESHOLDS: GateAThresholds = {
  contractVersion: "gate-a-2",
  qualifiedAttemptsPerObject: 5,
  requiredSuccessfulAnalyses: 5,
  minimumPeakAmplitude: 0.02,
  minimumSnrDb: 12,
  maximumClippedFraction: 0.001,
  maximumSecondaryTransientRatio: 0.65,
  minimumMatchedModesPerComparison: 3,
  maximumSessionMedianDriftCents: 25,
  maximumComparisonMedianDriftCents: 50,
  minimumDistinctSpecimens: 5,
  requiredMaterials: ["metal", "glass", "ceramic"],
};

export const DEFAULT_GATE_B_THRESHOLDS: GateBThresholds = {
  contractVersion: "gate-b-1",
  minimumObjects: 5,
  minimumPassingObjects: 4,
  minimumReviewersPerObject: 2,
  minimumIdentityMedian: 4,
  minimumBrightnessMedian: 3,
  minimumDecayMedian: 3,
  maximumArtifactMedian: 2,
  requiredMaterials: ["metal", "glass", "ceramic"],
};

export const DEFAULT_GATE_C_THRESHOLDS: GateCThresholds = {
  contractVersion: "gate-c-1",
  minimumObjects: 4,
  minimumPassingObjects: 4,
  minimumIdentityMedian: 4,
  minimumContinuityMedian: 4,
  minimumUsefulSemitoneSpan: 12,
  minimumDeviceCount: 2,
  requireMobileDevice: true,
};

const SOFTWARE_REVISION_PATTERN = /^[0-9a-f]{40}$/;

function normalizedLabel(label: string): string {
  return label.trim().toLocaleLowerCase("en-US");
}

function normalizedIdentifier(identifier: string): string {
  return identifier.trim().toLocaleLowerCase("en-US");
}

function targetKey(target: ReviewTarget): string {
  return `${target.sessionId}\u0000${target.attemptId}`;
}

function attemptsAreSequential(evidence: ValidationEvidenceV5): boolean {
  return evidence.attempts.every((attempt, index) => attempt.id === index + 1);
}

function captureQualityPasses(attempt: ValidationEvidenceAttempt, thresholds: GateAThresholds): boolean {
  const quality = attempt.quality;
  return quality.peakAmplitude >= thresholds.minimumPeakAmplitude
    && quality.snrDb >= thresholds.minimumSnrDb
    && quality.clippedFraction <= thresholds.maximumClippedFraction
    && quality.secondaryTransientRatio <= thresholds.maximumSecondaryTransientRatio;
}

function successfulAnalysis(attempt: ValidationEvidenceAttempt): boolean {
  return attempt.analysis.status === "success"
    && attempt.analysis.fingerprint.version === 1
    && isAcousticFingerprintAlgorithmVersion(attempt.analysis.fingerprint.algorithmVersion)
    && attempt.analysis.fingerprint.modes.length >= 3;
}

function evidenceAlgorithmVersions(evidence: ValidationEvidenceV5): ReadonlySet<string> {
  const versions = new Set<string>();
  for (const attempt of evidence.attempts) {
    if (attempt.analysis.status === "success"
      && isAcousticFingerprintAlgorithmVersion(attempt.analysis.fingerprint.algorithmVersion)) {
      versions.add(attempt.analysis.fingerprint.algorithmVersion);
    }
  }
  return versions;
}

export function evaluateGateASession(
  evidence: ValidationEvidenceV5,
  thresholds: GateAThresholds = DEFAULT_GATE_A_THRESHOLDS,
): GateASessionVerdict {
  const reasons: string[] = [];
  const qualifiedAttempts = evidence.attempts.length;
  const sequentialAttempts = attemptsAreSequential(evidence);
  const qualityPassingAttempts = evidence.attempts.filter((attempt) => captureQualityPasses(attempt, thresholds)).length;
  const successfulAnalyses = evidence.attempts.filter(successfulAnalysis).length;
  const analyticalFailures = qualifiedAttempts - successfulAnalyses;
  const algorithmVersions = evidenceAlgorithmVersions(evidence);
  const recurrence = deriveEvidenceRecurrence(evidence.attempts);
  const recurrenceComparisons = recurrence.length;
  const comparisonsWithEnoughMatches = recurrence.filter(
    (comparison) => comparison.matchedCount >= thresholds.minimumMatchedModesPerComparison,
  ).length;
  const recurrenceMedians = recurrence.map((comparison) => comparison.medianCents);
  const finiteRecurrenceMedians = recurrenceMedians.filter(Number.isFinite);
  const sessionMedianDriftCents = medianFinite(recurrenceMedians);
  const worstComparisonMedianDriftCents = finiteRecurrenceMedians.length === 0
    ? null
    : Math.max(...finiteRecurrenceMedians);

  if (!SOFTWARE_REVISION_PATTERN.test(evidence.softwareRevision)) reasons.push("software revision is invalid");
  if (algorithmVersions.size > 1) reasons.push("qualified attempts must use one fingerprint algorithm version");
  if (evidence.object.specimenId.trim().length === 0) reasons.push("specimen ID is missing");
  if (evidence.object.label.trim().length === 0) reasons.push("object label is missing");
  if (!evidence.protocol.fixedSetup) reasons.push("fixed-setup protocol is not declared");
  if (!(evidence.protocol.microphoneDistanceCm > 0)) reasons.push("microphone distance is invalid");
  if (evidence.protocol.striker.trim().length === 0) reasons.push("striker is missing");
  if (evidence.protocol.strikeLocation.trim().length === 0) reasons.push("strike location is missing");
  if (evidence.protocol.supportCondition.trim().length === 0) reasons.push("support condition is missing");
  if (evidence.rawMicrophoneSamplesIncluded !== false) reasons.push("raw microphone samples invariant failed");
  if (evidence.attemptCount !== qualifiedAttempts) reasons.push("attempt count does not match evidence attempts");
  if (!sequentialAttempts) reasons.push("qualified attempt IDs must be sequential from 1");
  if (qualifiedAttempts !== thresholds.qualifiedAttemptsPerObject) {
    reasons.push(`requires exactly ${thresholds.qualifiedAttemptsPerObject} acquisition-quality-passing attempts`);
  }
  if (
    qualityPassingAttempts !== qualifiedAttempts
    || qualityPassingAttempts !== thresholds.qualifiedAttemptsPerObject
  ) {
    reasons.push(`all ${thresholds.qualifiedAttemptsPerObject} retained attempts must satisfy the frozen acquisition-quality bounds`);
  }
  if (successfulAnalyses !== thresholds.requiredSuccessfulAnalyses) {
    reasons.push(`all ${thresholds.requiredSuccessfulAnalyses} qualified attempts must produce valid versioned fingerprints; analytical failures cannot be replaced`);
  }

  const requiredComparisons = Math.max(0, thresholds.requiredSuccessfulAnalyses - 1);
  if (recurrenceComparisons !== requiredComparisons) {
    reasons.push(`requires exactly ${requiredComparisons} recurrence comparisons from attempt 1 to attempts 2-${thresholds.requiredSuccessfulAnalyses}`);
  }
  if (comparisonsWithEnoughMatches < requiredComparisons) {
    reasons.push(`each release comparison needs at least ${thresholds.minimumMatchedModesPerComparison} matched modes`);
  }
  if (sessionMedianDriftCents === null || sessionMedianDriftCents > thresholds.maximumSessionMedianDriftCents) {
    reasons.push(`session median drift must be at most ${thresholds.maximumSessionMedianDriftCents} cents`);
  }
  if (
    worstComparisonMedianDriftCents === null
    || worstComparisonMedianDriftCents > thresholds.maximumComparisonMedianDriftCents
  ) {
    reasons.push(`worst comparison median drift must be at most ${thresholds.maximumComparisonMedianDriftCents} cents`);
  }

  const passed = reasons.length === 0;
  const reviewAttemptId = passed
    ? evidence.attempts[thresholds.qualifiedAttemptsPerObject - 1]?.id ?? null
    : null;

  return {
    sessionId: evidence.sessionId,
    softwareRevision: evidence.softwareRevision,
    specimenId: evidence.object.specimenId,
    objectLabel: evidence.object.label,
    material: evidence.object.material,
    reviewAttemptId,
    passed,
    metrics: {
      qualifiedAttempts,
      qualityPassingAttempts,
      successfulAnalyses,
      analyticalFailures,
      recurrenceComparisons,
      comparisonsWithEnoughMatches,
      sessionMedianDriftCents,
      worstComparisonMedianDriftCents,
    },
    reasons,
  };
}

export function evaluateGateARelease(
  evidence: readonly ValidationEvidenceV5[],
  thresholds: GateAThresholds = DEFAULT_GATE_A_THRESHOLDS,
): GateAReleaseVerdict {
  const sessions = evidence.map((bundle) => evaluateGateASession(bundle, thresholds));
  const passing = sessions.filter((session) => session.passed);
  const observedMaterialBySpecimen = new Map<string, MaterialClass>();
  const conflictingMaterialSpecimens = new Set<string>();
  const seenSessionIds = new Set<string>();
  const duplicateSessionIds = new Set<string>();
  const releaseAlgorithmVersions = new Set<string>();

  for (const bundle of evidence) {
    for (const version of evidenceAlgorithmVersions(bundle)) releaseAlgorithmVersions.add(version);
  }

  for (const session of sessions) {
    const sessionId = session.sessionId.trim();
    if (seenSessionIds.has(sessionId)) duplicateSessionIds.add(sessionId);
    else seenSessionIds.add(sessionId);

    const specimenId = normalizedIdentifier(session.specimenId);
    const previous = observedMaterialBySpecimen.get(specimenId);
    if (previous !== undefined && previous !== session.material) conflictingMaterialSpecimens.add(specimenId);
    else observedMaterialBySpecimen.set(specimenId, session.material);
  }

  const softwareRevisions = new Set(sessions.map((session) => session.softwareRevision));
  const softwareRevision = softwareRevisions.size === 1 ? [...softwareRevisions][0] ?? null : null;
  const distinctSpecimens = new Set(passing.map((session) => normalizedIdentifier(session.specimenId)));
  const materialCoverage = [...new Set(passing.map((session) => session.material))];
  const reasons: string[] = [];

  if (duplicateSessionIds.size > 0) {
    reasons.push(`duplicate session IDs: ${[...duplicateSessionIds].join(", ")}`);
  }
  if (softwareRevisions.size > 1) reasons.push("release evidence must use one software revision");
  if (releaseAlgorithmVersions.size > 1) reasons.push("release evidence must use one fingerprint algorithm version");
  if (conflictingMaterialSpecimens.size > 0) {
    reasons.push(`conflicting material classes for specimen IDs: ${[...conflictingMaterialSpecimens].join(", ")}`);
  }
  if (distinctSpecimens.size < thresholds.minimumDistinctSpecimens) {
    reasons.push(`requires ${thresholds.minimumDistinctSpecimens} distinct passing physical specimens`);
  }
  for (const material of thresholds.requiredMaterials) {
    if (!materialCoverage.includes(material)) reasons.push(`missing passing ${material} specimen`);
  }

  return {
    contractVersion: thresholds.contractVersion,
    passed: reasons.length === 0,
    softwareRevision,
    passingSessionCount: passing.length,
    distinctPassingSpecimenCount: distinctSpecimens.size,
    materialCoverage,
    sessions,
    reasons,
  };
}

function dedupeReviewsByReviewer<T extends { readonly reviewerId: string }>(reviews: readonly T[]): readonly T[] {
  const byReviewer = new Map<string, T>();
  for (const review of reviews) {
    const key = normalizedIdentifier(review.reviewerId);
    if (key.length > 0 && !byReviewer.has(key)) byReviewer.set(key, review);
  }
  return [...byReviewer.values()];
}

function dedupeGateCReviews(reviews: readonly GateCReview[]): readonly GateCReview[] {
  const unique = new Map<string, GateCReview>();
  for (const review of reviews) {
    const key = `${normalizedIdentifier(review.reviewerId)}\u0000${normalizedIdentifier(review.deviceId)}\u0000${targetKey(review)}`;
    if (!unique.has(key)) unique.set(key, review);
  }
  return [...unique.values()];
}

function gateASpecimenMaterialMap(gateA: GateAReleaseVerdict): ReadonlyMap<string, MaterialClass> {
  const map = new Map<string, MaterialClass>();
  for (const session of gateA.sessions) {
    if (session.passed) map.set(normalizedIdentifier(session.specimenId), session.material);
  }
  return map;
}

function eligibleSessionsForSpecimen(gateA: GateAReleaseVerdict, specimenKey: string) {
  return gateA.sessions.filter((session) => (
    session.passed
    && normalizedIdentifier(session.specimenId) === specimenKey
    && session.reviewAttemptId !== null
  ));
}

export function evaluateGateBRelease(
  gateA: GateAReleaseVerdict,
  reviews: readonly GateBReview[],
  thresholds: GateBThresholds = DEFAULT_GATE_B_THRESHOLDS,
): GateBReleaseVerdict {
  const materialBySpecimen = gateASpecimenMaterialMap(gateA);
  const candidateSpecimens = [...materialBySpecimen.keys()];
  const objects: GateBObjectVerdict[] = candidateSpecimens.map((specimenKey) => {
    const eligibleSessions = eligibleSessionsForSpecimen(gateA, specimenKey);
    const eligibleTargets = eligibleSessions.map((session) => ({
      sessionId: session.sessionId,
      attemptId: session.reviewAttemptId as number,
    }));
    const expectedLabelByTarget = new Map(eligibleSessions.map((session) => [
      targetKey({ sessionId: session.sessionId, attemptId: session.reviewAttemptId as number }),
      normalizedLabel(session.objectLabel),
    ] as const));
    const eligibleReviews = reviews.filter((review) => (
      review.blinded
      && expectedLabelByTarget.get(targetKey(review)) === normalizedLabel(review.objectLabel)
    ));
    const reviewedTargetKeys = new Set(eligibleReviews.map(targetKey));
    const selectedTargetKey = reviewedTargetKeys.size === 1 ? [...reviewedTargetKeys][0] : undefined;
    const selectedTarget = selectedTargetKey === undefined
      ? null
      : eligibleTargets.find((target) => targetKey(target) === selectedTargetKey) ?? null;
    const objectReviews = selectedTarget === null
      ? []
      : dedupeReviewsByReviewer(eligibleReviews.filter((review) => targetKey(review) === targetKey(selectedTarget)));
    const reasons: string[] = [];
    const identityMedian = medianFinite(objectReviews.map((review) => review.identity));
    const brightnessMedian = medianFinite(objectReviews.map((review) => review.brightness));
    const decayMedian = medianFinite(objectReviews.map((review) => review.decayCharacter));
    const artifactMedian = medianFinite(objectReviews.map((review) => review.artifactSeverity));

    if (reviewedTargetKeys.size > 1) {
      reasons.push("blinded reviews for one specimen must use a single passing-session measurement target");
    }
    if (objectReviews.length < thresholds.minimumReviewersPerObject) {
      reasons.push(`requires ${thresholds.minimumReviewersPerObject} blinded reviewers on one passing-session target`);
    }
    if (identityMedian === null || identityMedian < thresholds.minimumIdentityMedian) {
      reasons.push(`identity median must be at least ${thresholds.minimumIdentityMedian}`);
    }
    if (brightnessMedian === null || brightnessMedian < thresholds.minimumBrightnessMedian) {
      reasons.push(`brightness median must be at least ${thresholds.minimumBrightnessMedian}`);
    }
    if (decayMedian === null || decayMedian < thresholds.minimumDecayMedian) {
      reasons.push(`decay median must be at least ${thresholds.minimumDecayMedian}`);
    }
    if (artifactMedian === null || artifactMedian > thresholds.maximumArtifactMedian) {
      reasons.push(`artifact severity median must be at most ${thresholds.maximumArtifactMedian}`);
    }

    const exemplar = eligibleSessions[0];
    const material = materialBySpecimen.get(specimenKey);
    const verdict: GateBObjectVerdict = {
      specimenId: exemplar?.specimenId ?? specimenKey,
      objectLabel: exemplar?.objectLabel ?? specimenKey,
      eligibleTargets,
      selectedTarget,
      passed: reasons.length === 0,
      reviewerCount: objectReviews.length,
      identityMedian,
      brightnessMedian,
      decayMedian,
      artifactMedian,
      reasons,
    };
    return material === undefined ? verdict : { ...verdict, material };
  });

  const passing = objects.filter((object) => object.passed);
  const reviewedObjectCount = objects.filter((object) => object.reviewerCount > 0).length;
  const passingMaterials = new Set(
    passing.map((object) => object.material).filter((value): value is MaterialClass => value !== undefined),
  );
  const reasons: string[] = [];
  if (!gateA.passed) reasons.push("Gate A has not passed");
  if (reviewedObjectCount < thresholds.minimumObjects) reasons.push(`requires reviews for ${thresholds.minimumObjects} specimens`);
  if (passing.length < thresholds.minimumPassingObjects) reasons.push(`requires ${thresholds.minimumPassingObjects} passing specimens`);
  for (const material of thresholds.requiredMaterials) {
    if (!passingMaterials.has(material)) reasons.push(`missing passing ${material} reconstruction`);
  }

  return {
    contractVersion: thresholds.contractVersion,
    passed: reasons.length === 0,
    passingSpecimenCount: passing.length,
    objects,
    reasons,
  };
}

export function evaluateGateCRelease(
  gateB: GateBReleaseVerdict,
  reviews: readonly GateCReview[],
  thresholds: GateCThresholds = DEFAULT_GATE_C_THRESHOLDS,
): GateCReleaseVerdict {
  const eligibleObjects = gateB.objects.filter((object) => object.passed && object.selectedTarget !== null);
  const objects: GateCObjectVerdict[] = eligibleObjects.map((eligibleObject) => {
    const selectedTarget = eligibleObject.selectedTarget;
    if (selectedTarget === null) throw new Error("Passing Gate B specimen is missing a selected target");
    const selectedKey = targetKey(selectedTarget);
    const objectReviews = dedupeGateCReviews(reviews.filter((review) => (
      targetKey(review) === selectedKey
      && normalizedLabel(review.objectLabel) === normalizedLabel(eligibleObject.objectLabel)
    )));
    const reasons: string[] = [];
    const identityMedian = medianFinite(objectReviews.map((review) => review.identityAcrossRange));
    const continuityMedian = medianFinite(objectReviews.map((review) => review.timbreContinuity));
    const usefulSemitoneSpanMedian = medianFinite(objectReviews.map((review) => review.usefulSemitoneSpan));
    const latencyAcceptedByAll = objectReviews.length > 0 && objectReviews.every((review) => review.latencyAcceptable);

    if (objectReviews.length === 0) reasons.push("requires a device listening review on the Gate B selected measurement target");
    if (identityMedian === null || identityMedian < thresholds.minimumIdentityMedian) {
      reasons.push(`identity median must be at least ${thresholds.minimumIdentityMedian}`);
    }
    if (continuityMedian === null || continuityMedian < thresholds.minimumContinuityMedian) {
      reasons.push(`timbre continuity median must be at least ${thresholds.minimumContinuityMedian}`);
    }
    if (usefulSemitoneSpanMedian === null || usefulSemitoneSpanMedian < thresholds.minimumUsefulSemitoneSpan) {
      reasons.push(`useful range must span at least ${thresholds.minimumUsefulSemitoneSpan} semitones`);
    }
    if (!latencyAcceptedByAll) reasons.push("all submitted device reviews must accept note-on latency");

    return {
      specimenId: eligibleObject.specimenId,
      objectLabel: eligibleObject.objectLabel,
      passed: reasons.length === 0,
      reviewCount: objectReviews.length,
      identityMedian,
      continuityMedian,
      usefulSemitoneSpanMedian,
      latencyAcceptedByAll,
      reasons,
    };
  });

  const eligibleObjectByTarget = new Map(eligibleObjects.map((object) => [
    targetKey(object.selectedTarget as ReviewTarget),
    object,
  ] as const));
  const eligibleReviews = dedupeGateCReviews(reviews.filter((review) => {
    const object = eligibleObjectByTarget.get(targetKey(review));
    return object !== undefined
      && normalizedLabel(review.objectLabel) === normalizedLabel(object.objectLabel);
  }));
  const eligibleDeviceClassById = new Map<string, GateCReview["deviceClass"]>();
  const conflictingDeviceIds = new Set<string>();
  for (const review of eligibleReviews) {
    const deviceId = normalizedIdentifier(review.deviceId);
    if (deviceId.length === 0) continue;
    const previousClass = eligibleDeviceClassById.get(deviceId);
    if (previousClass !== undefined && previousClass !== review.deviceClass) conflictingDeviceIds.add(deviceId);
    else eligibleDeviceClassById.set(deviceId, review.deviceClass);
  }

  const passing = objects.filter((object) => object.passed);
  const passingSpecimens = new Set(passing.map((object) => normalizedIdentifier(object.specimenId)));
  const passingTargets = new Set(eligibleObjects
    .filter((object) => passingSpecimens.has(normalizedIdentifier(object.specimenId)))
    .map((object) => targetKey(object.selectedTarget as ReviewTarget)));
  const passingReviews = eligibleReviews.filter((review) => passingTargets.has(targetKey(review)));
  const passingDeviceClassById = new Map<string, GateCReview["deviceClass"]>();
  for (const review of passingReviews) {
    const deviceId = normalizedIdentifier(review.deviceId);
    if (deviceId.length > 0 && !passingDeviceClassById.has(deviceId)) {
      passingDeviceClassById.set(deviceId, review.deviceClass);
    }
  }
  const distinctDeviceCount = passingDeviceClassById.size;
  const hasMobileDevice = [...passingDeviceClassById.values()].includes("mobile");
  const reviewedObjectCount = objects.filter((object) => object.reviewCount > 0).length;
  const reasons: string[] = [];

  if (!gateB.passed) reasons.push("Gate B has not passed");
  if (reviewedObjectCount < thresholds.minimumObjects) reasons.push(`requires device reviews for ${thresholds.minimumObjects} specimens`);
  if (passing.length < thresholds.minimumPassingObjects) reasons.push(`requires ${thresholds.minimumPassingObjects} passing specimens`);
  if (conflictingDeviceIds.size > 0) {
    reasons.push(`conflicting device classes for: ${[...conflictingDeviceIds].join(", ")}`);
  }
  if (distinctDeviceCount < thresholds.minimumDeviceCount) reasons.push(`requires ${thresholds.minimumDeviceCount} distinct devices`);
  if (thresholds.requireMobileDevice && !hasMobileDevice) reasons.push("requires at least one mobile-device review");

  return {
    contractVersion: thresholds.contractVersion,
    passed: reasons.length === 0,
    passingSpecimenCount: passing.length,
    distinctDeviceCount,
    hasMobileDevice,
    objects,
    reasons,
  };
}

export function buildReleaseVerdict(
  evidence: readonly ValidationEvidenceV5[],
  gateBReviews: readonly GateBReview[],
  gateCReviews: readonly GateCReview[],
  createdAt: string,
): ReleaseVerdict {
  const gateA = evaluateGateARelease(evidence);
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
