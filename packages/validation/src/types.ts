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

export interface ValidationEvidenceRecord {
  readonly id: number;
  readonly quality: CaptureQualityEvidence;
  readonly fingerprint: AcousticFingerprintV1;
}

export interface EvidenceRecurrence extends FingerprintRecurrence {
  readonly recordId: number;
}

export interface ReviewTarget {
  readonly sessionId: string;
  readonly recordId: number;
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

export interface ValidationEvidenceV3 {
  readonly schemaVersion: 3;
  readonly evidenceContractVersion: "validation-evidence-3";
  readonly gateAContractVersion: "gate-a-1";
  readonly sessionId: string;
  readonly createdAt: string;
  readonly object: ValidationObjectMetadata;
  readonly protocol: FixedSetupProtocol;
  readonly captureSettings: CaptureSettingsEvidence | null;
  readonly realtimeAudioTiming: RealtimeAudioTimingEvidence | null;
  readonly recordCount: number;
  readonly medianModalDriftCents: number | null;
  readonly recurrence: readonly EvidenceRecurrence[];
  readonly records: readonly ValidationEvidenceRecord[];
  readonly gateBReviews: readonly GateBReview[];
  readonly gateCReviews: readonly GateCReview[];
  readonly rawMicrophoneSamplesIncluded: false;
}

export interface GateAThresholds {
  readonly contractVersion: "gate-a-1";
  readonly acceptedStrikesPerObject: number;
  readonly minimumPeakAmplitude: number;
  readonly minimumSnrDb: number;
  readonly maximumClippedFraction: number;
  readonly maximumSecondaryTransientRatio: number;
  readonly minimumStableModes: number;
  readonly minimumStrikesWithStableModes: number;
  readonly minimumMatchedModesPerComparison: number;
  readonly maximumSessionMedianDriftCents: number;
  readonly maximumComparisonMedianDriftCents: number;
  readonly minimumDistinctObjects: number;
  readonly requiredMaterials: readonly MaterialClass[];
}

export interface GateASessionMetrics {
  readonly acceptedStrikes: number;
  readonly qualityPassingStrikes: number;
  readonly strikesWithStableModes: number;
  readonly recurrenceComparisons: number;
  readonly comparisonsWithEnoughMatches: number;
  readonly sessionMedianDriftCents: number | null;
  readonly worstComparisonMedianDriftCents: number | null;
}

export interface GateASessionVerdict {
  readonly sessionId: string;
  readonly objectLabel: string;
  readonly material: MaterialClass;
  readonly reviewRecordId: number | null;
  readonly passed: boolean;
  readonly metrics: GateASessionMetrics;
  readonly reasons: readonly string[];
}

export interface GateAReleaseVerdict {
  readonly contractVersion: "gate-a-1";
  readonly passed: boolean;
  readonly passingObjectCount: number;
  readonly distinctPassingObjectCount: number;
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
  readonly objectLabel: string;
  readonly material?: MaterialClass;
  readonly eligibleTargets: readonly ReviewTarget[];
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
  readonly passingObjectCount: number;
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
  readonly passingObjectCount: number;
  readonly distinctDeviceCount: number;
  readonly hasMobileDevice: boolean;
  readonly objects: readonly GateCObjectVerdict[];
  readonly reasons: readonly string[];
}

export interface ReleaseVerdict {
  readonly schemaVersion: 1;
  readonly createdAt: string;
  readonly gateA: GateAReleaseVerdict;
  readonly gateB: GateBReleaseVerdict;
  readonly gateC: GateCReleaseVerdict;
  readonly releaseReady: boolean;
}
