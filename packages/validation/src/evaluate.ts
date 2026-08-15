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
  ValidationEvidenceV3,
} from "./types";

export const DEFAULT_GATE_A_THRESHOLDS: GateAThresholds = {
  contractVersion: "gate-a-1",
  acceptedStrikesPerObject: 5,
  minimumStableModes: 3,
  minimumStrikesWithStableModes: 4,
  minimumMatchedModesPerComparison: 3,
  maximumSessionMedianDriftCents: 25,
  maximumComparisonMedianDriftCents: 50,
  minimumDistinctObjects: 5,
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

function median(values: readonly number[]): number | null {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finite.length === 0) return null;
  const middle = Math.floor(finite.length / 2);
  const upper = finite[middle];
  if (upper === undefined) return null;
  if (finite.length % 2 === 1) return upper;
  return ((finite[middle - 1] ?? upper) + upper) / 2;
}

function normalizedLabel(label: string): string {
  return label.trim().toLocaleLowerCase("en-US");
}

export function evaluateGateASession(
  evidence: ValidationEvidenceV3,
  thresholds: GateAThresholds = DEFAULT_GATE_A_THRESHOLDS,
): GateASessionVerdict {
  const reasons: string[] = [];
  const acceptedStrikes = evidence.records.length;
  const strikesWithStableModes = evidence.records.filter(
    (record) => record.fingerprint.modes.length >= thresholds.minimumStableModes,
  ).length;
  const recurrenceComparisons = evidence.recurrence.length;
  const comparisonsWithEnoughMatches = evidence.recurrence.filter(
    (comparison) => comparison.matchedCount >= thresholds.minimumMatchedModesPerComparison,
  ).length;
  const recurrenceMedians = evidence.recurrence.map((comparison) => comparison.medianCents);
  const finiteRecurrenceMedians = recurrenceMedians.filter(Number.isFinite);
  const sessionMedianDriftCents = median(recurrenceMedians);
  const worstComparisonMedianDriftCents = finiteRecurrenceMedians.length === 0
    ? null
    : Math.max(...finiteRecurrenceMedians);

  if (evidence.object.label.trim().length === 0) reasons.push("object label is missing");
  if (!evidence.protocol.fixedSetup) reasons.push("fixed-setup protocol is not declared");
  if (!(evidence.protocol.microphoneDistanceCm > 0)) reasons.push("microphone distance is invalid");
  if (evidence.protocol.striker.trim().length === 0) reasons.push("striker is missing");
  if (evidence.protocol.strikeLocation.trim().length === 0) reasons.push("strike location is missing");
  if (evidence.protocol.supportCondition.trim().length === 0) reasons.push("support condition is missing");
  if (evidence.rawMicrophoneSamplesIncluded !== false) reasons.push("raw microphone samples invariant failed");
  if (evidence.recordCount !== acceptedStrikes) reasons.push("record count does not match evidence records");
  if (acceptedStrikes !== thresholds.acceptedStrikesPerObject) {
    reasons.push(`requires exactly ${thresholds.acceptedStrikesPerObject} accepted strikes`);
  }
  if (strikesWithStableModes < thresholds.minimumStrikesWithStableModes) {
    reasons.push(`requires ${thresholds.minimumStrikesWithStableModes} strikes with at least ${thresholds.minimumStableModes} stable modes`);
  }
  const requiredComparisons = Math.max(0, thresholds.acceptedStrikesPerObject - 1);
  if (recurrenceComparisons !== requiredComparisons) {
    reasons.push(`requires exactly ${requiredComparisons} recurrence comparisons`);
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

  return {
    sessionId: evidence.sessionId,
    objectLabel: evidence.object.label,
    material: evidence.object.material,
    passed: reasons.length === 0,
    metrics: {
      acceptedStrikes,
      strikesWithStableModes,
      recurrenceComparisons,
      comparisonsWithEnoughMatches,
      sessionMedianDriftCents,
      worstComparisonMedianDriftCents,
    },
    reasons,
  };
}

export function evaluateGateARelease(
  evidence: readonly ValidationEvidenceV3[],
  thresholds: GateAThresholds = DEFAULT_GATE_A_THRESHOLDS,
): GateAReleaseVerdict {
  const sessions = evidence.map((bundle) => evaluateGateASession(bundle, thresholds));
  const passing = sessions.filter((session) => session.passed);
  const materialByLabel = new Map<string, MaterialClass>();
  const conflictingMaterialLabels = new Set<string>();
  for (const session of passing) {
    const label = normalizedLabel(session.objectLabel);
    const previous = materialByLabel.get(label);
    if (previous !== undefined && previous !== session.material) {
      conflictingMaterialLabels.add(label);
    } else {
      materialByLabel.set(label, session.material);
    }
  }
  const distinctLabels = new Set(materialByLabel.keys());
  const materialCoverage = [...new Set(materialByLabel.values())];
  const reasons: string[] = [];

  if (conflictingMaterialLabels.size > 0) {
    reasons.push(`conflicting material labels for: ${[...conflictingMaterialLabels].join(", ")}`);
  }
  if (distinctLabels.size < thresholds.minimumDistinctObjects) {
    reasons.push(`requires ${thresholds.minimumDistinctObjects} distinct passing objects`);
  }
  for (const material of thresholds.requiredMaterials) {
    if (!materialCoverage.includes(material)) reasons.push(`missing passing ${material} object`);
  }

  return {
    contractVersion: thresholds.contractVersion,
    passed: reasons.length === 0,
    passingObjectCount: passing.length,
    distinctPassingObjectCount: distinctLabels.size,
    materialCoverage,
    sessions,
    reasons,
  };
}

function dedupeReviewsByReviewer<T extends { readonly reviewerId: string }>(reviews: readonly T[]): readonly T[] {
  const byReviewer = new Map<string, T>();
  for (const review of reviews) {
    const key = review.reviewerId.trim();
    if (key.length > 0 && !byReviewer.has(key)) byReviewer.set(key, review);
  }
  return [...byReviewer.values()];
}

function gateAMaterialMap(gateA: GateAReleaseVerdict): ReadonlyMap<string, MaterialClass> {
  const map = new Map<string, MaterialClass>();
  for (const session of gateA.sessions) {
    if (session.passed) map.set(normalizedLabel(session.objectLabel), session.material);
  }
  return map;
}

export function evaluateGateBRelease(
  gateA: GateAReleaseVerdict,
  reviews: readonly GateBReview[],
  thresholds: GateBThresholds = DEFAULT_GATE_B_THRESHOLDS,
): GateBReleaseVerdict {
  const materialByObject = gateAMaterialMap(gateA);
  const candidateLabels = [...materialByObject.keys()];
  const objects: GateBObjectVerdict[] = candidateLabels.map((labelKey) => {
    const objectReviews = dedupeReviewsByReviewer(
      reviews.filter((review) => normalizedLabel(review.objectLabel) === labelKey && review.blinded),
    );
    const reasons: string[] = [];
    const identityMedian = median(objectReviews.map((review) => review.identity));
    const brightnessMedian = median(objectReviews.map((review) => review.brightness));
    const decayMedian = median(objectReviews.map((review) => review.decayCharacter));
    const artifactMedian = median(objectReviews.map((review) => review.artifactSeverity));

    if (objectReviews.length < thresholds.minimumReviewersPerObject) {
      reasons.push(`requires ${thresholds.minimumReviewersPerObject} blinded reviewers`);
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

    const exemplar = gateA.sessions.find(
      (session) => session.passed && normalizedLabel(session.objectLabel) === labelKey,
    );
    const material = materialByObject.get(labelKey);
    const verdict: GateBObjectVerdict = {
      objectLabel: exemplar?.objectLabel ?? labelKey,
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
  if (reviewedObjectCount < thresholds.minimumObjects) reasons.push(`requires reviews for ${thresholds.minimumObjects} objects`);
  if (passing.length < thresholds.minimumPassingObjects) reasons.push(`requires ${thresholds.minimumPassingObjects} passing objects`);
  for (const material of thresholds.requiredMaterials) {
    if (!passingMaterials.has(material)) reasons.push(`missing passing ${material} reconstruction`);
  }

  return {
    contractVersion: thresholds.contractVersion,
    passed: reasons.length === 0,
    passingObjectCount: passing.length,
    objects,
    reasons,
  };
}

export function evaluateGateCRelease(
  gateB: GateBReleaseVerdict,
  reviews: readonly GateCReview[],
  thresholds: GateCThresholds = DEFAULT_GATE_C_THRESHOLDS,
): GateCReleaseVerdict {
  const eligibleLabels = gateB.objects.filter((object) => object.passed).map((object) => normalizedLabel(object.objectLabel));
  const objects: GateCObjectVerdict[] = eligibleLabels.map((labelKey) => {
    const objectReviews = reviews.filter((review) => normalizedLabel(review.objectLabel) === labelKey);
    const reasons: string[] = [];
    const identityMedian = median(objectReviews.map((review) => review.identityAcrossRange));
    const continuityMedian = median(objectReviews.map((review) => review.timbreContinuity));
    const usefulSemitoneSpanMedian = median(objectReviews.map((review) => review.usefulSemitoneSpan));
    const latencyAcceptedByAll = objectReviews.length > 0 && objectReviews.every((review) => review.latencyAcceptable);

    if (objectReviews.length === 0) reasons.push("requires a device listening review");
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

    const exemplar = gateB.objects.find(
      (object) => object.passed && normalizedLabel(object.objectLabel) === labelKey,
    );
    return {
      objectLabel: exemplar?.objectLabel ?? labelKey,
      passed: reasons.length === 0,
      reviewCount: objectReviews.length,
      identityMedian,
      continuityMedian,
      usefulSemitoneSpanMedian,
      latencyAcceptedByAll,
      reasons,
    };
  });

  const consideredReviews = reviews.filter((review) => eligibleLabels.includes(normalizedLabel(review.objectLabel)));
  const distinctDeviceCount = new Set(consideredReviews.map((review) => review.deviceId.trim()).filter(Boolean)).size;
  const hasMobileDevice = consideredReviews.some((review) => review.deviceClass === "mobile");
  const passing = objects.filter((object) => object.passed);
  const reviewedObjectCount = objects.filter((object) => object.reviewCount > 0).length;
  const reasons: string[] = [];

  if (!gateB.passed) reasons.push("Gate B has not passed");
  if (reviewedObjectCount < thresholds.minimumObjects) reasons.push(`requires device reviews for ${thresholds.minimumObjects} objects`);
  if (passing.length < thresholds.minimumPassingObjects) reasons.push(`requires ${thresholds.minimumPassingObjects} passing objects`);
  if (distinctDeviceCount < thresholds.minimumDeviceCount) reasons.push(`requires ${thresholds.minimumDeviceCount} distinct devices`);
  if (thresholds.requireMobileDevice && !hasMobileDevice) reasons.push("requires at least one mobile-device review");

  return {
    contractVersion: thresholds.contractVersion,
    passed: reasons.length === 0,
    passingObjectCount: passing.length,
    distinctDeviceCount,
    hasMobileDevice,
    objects,
    reasons,
  };
}

export function buildReleaseVerdict(
  evidence: readonly ValidationEvidenceV3[],
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
    gateA,
    gateB,
    gateC,
    releaseReady: gateA.passed && gateB.passed && gateC.passed,
  };
}
