import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import type { FingerprintRecurrence } from "@everything-rings/fingerprint";

export type MaterialClass =
  | "metal"
  | "glass"
  | "ceramic"
  | "wood"
  | "stone"
  | "plastic"
  | "composite"
  | "other";

export type Score1To5 = 1 | 2 | 3 | 4 | 5;
export type DeviceClass = "desktop" | "mobile" | "tablet" | "other";
export type GateBPresentationOrder = "original-model" | "model-original";
export type AnalysisFailureReasonEvidence =
  | "SIGNAL_TOO_SHORT"
  | "NO_STABLE_RESONANCES"
  | "ANALYSIS_INTERNAL_ERROR";

export interface CaptureSettingsEvidence {
  readonly sampleRate?: number;
  readonly channelCount?: number;
  readonly echoCancellation?: boolean;
  readonly noiseSuppression?: boolean;
  readonly autoGainControl?: boolean;
  readonly deviceId?: string;
}

export interface CaptureQualityEvidence {
  readonly score: number;
  readonly snrDb: number;
  readonly clippedFraction: number;
  readonly peakAmplitude: number;
  readonly secondaryTransientRatio: number;
}

export interface ValidationObjectMetadata {
  readonly specimenId: string;
  readonly label: string;
  readonly material: MaterialClass;
}

export interface FixedSetupProtocol {
  readonly fixedSetup: true;
  readonly microphoneDistanceCm: number;
  readonly striker: string;
  readonly strikeLocation: string;
  readonly supportCondition: string;
}

export interface RealtimeAudioTimingEvidence {
  readonly baseLatencyMs: number;
  readonly outputLatencyMs?: number;
  readonly renderQuantumMs: number;
  readonly lastSchedulingMs?: number;
}

export type ValidationAttemptAnalysis =
  | {
      readonly status: "success";
      readonly fingerprint: AcousticFingerprintV1;
    }
  | {
      readonly status: "failure";
      readonly reason: AnalysisFailureReasonEvidence;
    };

export interface ValidationEvidenceAttempt {
  readonly id: number;
  readonly quality: CaptureQualityEvidence;
  readonly analysis: ValidationAttemptAnalysis;
}

export interface EvidenceRecurrence extends FingerprintRecurrence {
  readonly attemptId: number;
}

export interface ReviewTarget {
  readonly sessionId: string;
  readonly attemptId: number;
}

export interface GateBReview extends ReviewTarget {
  readonly reviewId: string;
  readonly reviewerId: string;
  readonly objectLabel: string;
  readonly blinded: boolean;
  readonly presentationOrder: GateBPresentationOrder;
  readonly identity: Score1To5;
  readonly brightness: Score1To5;
  readonly decayCharacter: Score1To5;
  readonly artifactSeverity: Score1To5;
}

export interface GateCReview extends ReviewTarget {
  readonly reviewId: string;
  readonly reviewerId: string;
  readonly objectLabel: string;
  readonly deviceId: string;
  readonly deviceClass: DeviceClass;
  readonly identityAcrossRange: Score1To5;
  readonly timbreContinuity: Score1To5;
  readonly usefulSemitoneSpan: number;
  readonly latencyAcceptable: boolean;
}

export interface ValidationEvidenceV5 {
  readonly schemaVersion: 5;
  readonly evidenceContractVersion: "validation-evidence-5";
  readonly gateAContractVersion: "gate-a-2";
  readonly sessionId: string;
  readonly createdAt: string;
  readonly softwareRevision: string;
  readonly object: ValidationObjectMetadata;
  readonly protocol: FixedSetupProtocol;
  readonly captureSettings: CaptureSettingsEvidence | null;
  readonly realtimeAudioTiming: RealtimeAudioTimingEvidence | null;
  readonly attemptCount: number;
  readonly medianModalDriftCents: number | null;
  readonly recurrence: readonly EvidenceRecurrence[];
  readonly attempts: readonly ValidationEvidenceAttempt[];
  readonly gateBReviews: readonly GateBReview[];
  readonly gateCReviews: readonly GateCReview[];
  readonly rawMicrophoneSamplesIncluded: false;
}

export interface GateAThresholds {
  readonly contractVersion: "gate-a-2";
  readonly qualifiedAttemptsPerObject: number;
  readonly requiredSuccessfulAnalyses: number;
  readonly minimumPeakAmplitude: number;
  readonly minimumSnrDb: number;
  readonly maximumClippedFraction: number;
  readonly maximumSecondaryTransientRatio: number;
  readonly minimumMatchedModesPerComparison: number;
  readonly maximumSessionMedianDriftCents: number;
  readonly maximumComparisonMedianDriftCents: number;
  readonly minimumDistinctSpecimens: number;
  readonly requiredMaterials: readonly MaterialClass[];
}

export interface GateASessionMetrics {
  readonly qualifiedAttempts: number;
  readonly qualityPassingAttempts: number;
  readonly successfulAnalyses: number;
  readonly analyticalFailures: number;
  readonly recurrenceComparisons: number;
  readonly comparisonsWithEnoughMatches: number;
  readonly sessionMedianDriftCents: number | null;
  readonly worstComparisonMedianDriftCents: number | null;
}

export interface GateASessionVerdict {
  readonly sessionId: string;
  readonly softwareRevision: string;
  readonly specimenId: string;
  readonly objectLabel: string;
  readonly material: MaterialClass;
  readonly reviewAttemptId: number | null;
  readonly passed: boolean;
  readonly metrics: GateASessionMetrics;
  readonly reasons: readonly string[];
}

export interface GateAReleaseVerdict {
  readonly contractVersion: "gate-a-2";
  readonly passed: boolean;
  readonly softwareRevision: string | null;
  readonly passingSessionCount: number;
  readonly distinctPassingSpecimenCount: number;
  readonly materialCoverage: readonly MaterialClass[];
  readonly sessions: readonly GateASessionVerdict[];
  readonly reasons: readonly string[];
}

export interface GateBThresholds {
  readonly contractVersion: "gate-b-1";
  readonly minimumObjects: number;
  readonly minimumPassingObjects: number;
  readonly minimumReviewersPerObject: number;
  readonly minimumIdentityMedian: number;
  readonly minimumBrightnessMedian: number;
  readonly minimumDecayMedian: number;
  readonly maximumArtifactMedian: number;
  readonly requiredMaterials: readonly MaterialClass[];
}

export interface GateBObjectVerdict {
  readonly specimenId: string;
  readonly objectLabel: string;
  readonly material?: MaterialClass;
  readonly eligibleTargets: readonly ReviewTarget[];
  readonly selectedTarget: ReviewTarget | null;
  readonly passed: boolean;
  readonly reviewerCount: number;
  readonly identityMedian: number | null;
  readonly brightnessMedian: number | null;
  readonly decayMedian: number | null;
  readonly artifactMedian: number | null;
  readonly reasons: readonly string[];
}

export interface GateBReleaseVerdict {
  readonly contractVersion: "gate-b-1";
  readonly passed: boolean;
  readonly passingSpecimenCount: number;
  readonly objects: readonly GateBObjectVerdict[];
  readonly reasons: readonly string[];
}

export interface GateCThresholds {
  readonly contractVersion: "gate-c-1";
  readonly minimumObjects: number;
  readonly minimumPassingObjects: number;
  readonly minimumIdentityMedian: number;
  readonly minimumContinuityMedian: number;
  readonly minimumUsefulSemitoneSpan: number;
  readonly minimumDeviceCount: number;
  readonly requireMobileDevice: boolean;
}

export interface GateCObjectVerdict {
  readonly specimenId: string;
  readonly objectLabel: string;
  readonly passed: boolean;
  readonly reviewCount: number;
  readonly identityMedian: number | null;
  readonly continuityMedian: number | null;
  readonly usefulSemitoneSpanMedian: number | null;
  readonly latencyAcceptedByAll: boolean;
  readonly reasons: readonly string[];
}

export interface GateCReleaseVerdict {
  readonly contractVersion: "gate-c-1";
  readonly passed: boolean;
  readonly passingSpecimenCount: number;
  readonly distinctDeviceCount: number;
  readonly hasMobileDevice: boolean;
  readonly objects: readonly GateCObjectVerdict[];
  readonly reasons: readonly string[];
}

export interface ReleaseVerdict {
  readonly schemaVersion: 1;
  readonly createdAt: string;
  readonly softwareRevision: string | null;
  readonly gateA: GateAReleaseVerdict;
  readonly gateB: GateBReleaseVerdict;
  readonly gateC: GateCReleaseVerdict;
  readonly releaseReady: boolean;
}
