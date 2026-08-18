export {
  DEFAULT_GATE_A_THRESHOLDS,
  DEFAULT_GATE_B_THRESHOLDS,
  DEFAULT_GATE_C_THRESHOLDS,
  evaluateGateARelease,
  evaluateGateASession,
  evaluateGateBRelease,
  evaluateGateCRelease,
} from "./evaluate";
export {
  buildReleaseVerdict,
  buildReleaseVerdictForRevision,
} from "./current-release";
export {
  empiricalCampaignSignature,
  evaluateEmpiricalCampaign,
  parseEmpiricalCampaign,
  parseEmpiricalCampaignJson,
  type EmpiricalCampaignCohort,
  type EmpiricalCampaignParseResult,
  type EmpiricalCampaignProgress,
  type EmpiricalCampaignSpecimen,
  type EmpiricalCampaignSpecimenStatus,
  type EmpiricalCampaignV1,
} from "./campaign";
export {
  deriveEvidenceRecurrence,
  deriveMedianModalDriftCents,
  medianFinite,
  successfulFingerprint,
} from "./derive";
export {
  mergeValidationEvidence,
  type EvidenceMergeResult,
} from "./merge";
export {
  parseValidationEvidence,
  parseValidationEvidenceJson,
  type EvidenceParseResult,
} from "./parse";
export type {
  AnalysisFailureReasonEvidence,
  CaptureQualityEvidence,
  CaptureSettingsEvidence,
  DeviceClass,
  EvidenceRecurrence,
  FixedSetupProtocol,
  GateAReleaseVerdict,
  GateASessionMetrics,
  GateASessionVerdict,
  GateAThresholds,
  GateBObjectVerdict,
  GateBPresentationOrder,
  GateBReleaseVerdict,
  GateBReview,
  GateBThresholds,
  GateCObjectVerdict,
  GateCReleaseVerdict,
  GateCReview,
  GateCThresholds,
  MaterialClass,
  RealtimeAudioTimingEvidence,
  ReleaseVerdict,
  ReviewTarget,
  Score1To5,
  ValidationAttemptAnalysis,
  ValidationEvidenceAttempt,
  ValidationEvidenceV5,
  ValidationObjectMetadata,
} from "./types";
