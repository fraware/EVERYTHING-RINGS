export interface SimilarityAlgorithmHeldOutMetricsV1 {
  readonly algorithmVersion: string;
  readonly evaluationPopulation: string;
  readonly specimenDisjoint: boolean;
  readonly queryCount: number;
  readonly recallAt1: number | null;
  readonly meanReciprocalRank: number | null;
  readonly rocAuc: number | null;
  readonly brierScore: number | null;
  readonly coverage: number;
}

export interface SimilarityPromotionPolicyV1 {
  readonly policyVersion: "similarity-promotion-policy-1";
  readonly minimumQueryCount: number;
  readonly minimumCoverage: number;
  readonly maximumRecallAt1Regression: number;
  readonly maximumMrrRegression: number;
  readonly maximumAucRegression: number;
  readonly maximumBrierIncrease: number;
  readonly minimumAnyPrimaryImprovement: number;
}

export const DEFAULT_SIMILARITY_PROMOTION_POLICY: SimilarityPromotionPolicyV1 = {
  policyVersion: "similarity-promotion-policy-1",
  minimumQueryCount: 20,
  minimumCoverage: 0.5,
  maximumRecallAt1Regression: 0,
  maximumMrrRegression: 0,
  maximumAucRegression: 0,
  maximumBrierIncrease: 0,
  minimumAnyPrimaryImprovement: 0.01,
};

export interface SimilarityPromotionVerdictV1 {
  readonly verdictVersion: "similarity-promotion-verdict-1";
  readonly promoted: boolean;
  readonly baselineAlgorithmVersion: string;
  readonly candidateAlgorithmVersion: string;
  readonly evaluationPopulation: string;
  readonly reasons: readonly string[];
  readonly improvements: {
    readonly recallAt1: number | null;
    readonly meanReciprocalRank: number | null;
    readonly rocAuc: number | null;
    readonly brierScoreReduction: number | null;
  };
}

function delta(candidate: number | null, baseline: number | null): number | null {
  return candidate === null || baseline === null ? null : candidate - baseline;
}

export function evaluateSimilarityAlgorithmPromotion(
  baseline: SimilarityAlgorithmHeldOutMetricsV1,
  candidate: SimilarityAlgorithmHeldOutMetricsV1,
  policy: SimilarityPromotionPolicyV1 = DEFAULT_SIMILARITY_PROMOTION_POLICY,
): SimilarityPromotionVerdictV1 {
  const reasons: string[] = [];
  if (baseline.evaluationPopulation !== candidate.evaluationPopulation) reasons.push("baseline and candidate evaluation populations differ");
  if (!baseline.specimenDisjoint || !candidate.specimenDisjoint) reasons.push("promotion requires specimen-disjoint held-out evaluation");
  if (candidate.queryCount < policy.minimumQueryCount) reasons.push(`candidate query count is below ${policy.minimumQueryCount}`);
  if (candidate.coverage < policy.minimumCoverage) reasons.push(`candidate coverage is below ${policy.minimumCoverage}`);

  const recall = delta(candidate.recallAt1, baseline.recallAt1);
  const mrr = delta(candidate.meanReciprocalRank, baseline.meanReciprocalRank);
  const auc = delta(candidate.rocAuc, baseline.rocAuc);
  const brierReduction = baseline.brierScore === null || candidate.brierScore === null ? null : baseline.brierScore - candidate.brierScore;
  if (recall !== null && recall < -policy.maximumRecallAt1Regression) reasons.push("candidate regresses Recall@1 beyond policy");
  if (mrr !== null && mrr < -policy.maximumMrrRegression) reasons.push("candidate regresses MRR beyond policy");
  if (auc !== null && auc < -policy.maximumAucRegression) reasons.push("candidate regresses ROC AUC beyond policy");
  if (brierReduction !== null && brierReduction < -policy.maximumBrierIncrease) reasons.push("candidate increases Brier score beyond policy");

  const primaryImprovements = [recall, mrr, auc, brierReduction].filter((value): value is number => value !== null);
  if (primaryImprovements.length === 0) reasons.push("no comparable primary held-out metric exists");
  else if (Math.max(...primaryImprovements) < policy.minimumAnyPrimaryImprovement) reasons.push(`candidate does not improve any primary metric by ${policy.minimumAnyPrimaryImprovement}`);

  return {
    verdictVersion: "similarity-promotion-verdict-1",
    promoted: reasons.length === 0,
    baselineAlgorithmVersion: baseline.algorithmVersion,
    candidateAlgorithmVersion: candidate.algorithmVersion,
    evaluationPopulation: candidate.evaluationPopulation,
    reasons,
    improvements: { recallAt1: recall, meanReciprocalRank: mrr, rocAuc: auc, brierScoreReduction: brierReduction },
  };
}

export type PhysicalSonicTwinPromotionFreezeState = "unfrozen-template" | "frozen";

/**
 * Preregistration template for a physical Sonic Twin product claim.
 * Distinct from DEFAULT_SIMILARITY_PROMOTION_POLICY, which is a development rule.
 * Thresholds stay null until a named R2-scale policy is frozen before evaluation.
 * This object is never itself a product-eligibility grant.
 */
export interface PhysicalSonicTwinPromotionPolicyV1 {
  readonly policyVersion: "physical-sonic-twin-promotion-policy-1";
  readonly freezeState: PhysicalSonicTwinPromotionFreezeState;
  readonly productEligible: false;
  readonly evaluationPopulation: string | null;
  readonly minimumHeldOutSpecimenCount: number | null;
  readonly minimumHeldOutQueryCount: number | null;
  readonly minimumStationCount: number | null;
  readonly maximumFalseMatchRate: number | null;
  readonly minimumTrueNegativeRate: number | null;
  readonly minimumCoverage: number | null;
  readonly maximumBrierScore: number | null;
  readonly maximumEce: number | null;
  readonly minimumRecallAt1: number | null;
  readonly preregisteredBeforeEvaluation: boolean;
}

export const UNFROZEN_PHYSICAL_SONIC_TWIN_PROMOTION_POLICY: PhysicalSonicTwinPromotionPolicyV1 = {
  policyVersion: "physical-sonic-twin-promotion-policy-1",
  freezeState: "unfrozen-template",
  productEligible: false,
  evaluationPopulation: null,
  minimumHeldOutSpecimenCount: null,
  minimumHeldOutQueryCount: null,
  minimumStationCount: null,
  maximumFalseMatchRate: null,
  minimumTrueNegativeRate: null,
  minimumCoverage: null,
  maximumBrierScore: null,
  maximumEce: null,
  minimumRecallAt1: null,
  preregisteredBeforeEvaluation: false,
};

export interface PhysicalSonicTwinHeldOutMetricsV1 {
  readonly metricsVersion: "physical-sonic-twin-held-out-metrics-1";
  readonly evaluationPopulation: string;
  readonly specimenDisjoint: boolean;
  readonly heldOutSpecimenCount: number;
  readonly heldOutQueryCount: number;
  readonly stationCount: number;
  readonly falseMatchRate: number | null;
  readonly trueNegativeRate: number | null;
  readonly coverage: number;
  readonly brierScore: number | null;
  readonly ece: number | null;
  readonly recallAt1: number | null;
}

export interface PhysicalSonicTwinPromotionVerdictV1 {
  readonly verdictVersion: "physical-sonic-twin-promotion-verdict-1";
  readonly policyVersion: "physical-sonic-twin-promotion-policy-1";
  readonly freezeState: PhysicalSonicTwinPromotionFreezeState;
  readonly productEligible: boolean;
  readonly promoted: boolean;
  readonly reasons: readonly string[];
}

function thresholdMissing(policy: PhysicalSonicTwinPromotionPolicyV1): boolean {
  return policy.evaluationPopulation === null
    || policy.minimumHeldOutSpecimenCount === null
    || policy.minimumHeldOutQueryCount === null
    || policy.minimumStationCount === null
    || policy.maximumFalseMatchRate === null
    || policy.minimumTrueNegativeRate === null
    || policy.minimumCoverage === null
    || policy.maximumBrierScore === null
    || policy.maximumEce === null
    || policy.minimumRecallAt1 === null;
}

export function evaluatePhysicalSonicTwinPromotion(
  policy: PhysicalSonicTwinPromotionPolicyV1,
  metrics: PhysicalSonicTwinHeldOutMetricsV1,
): PhysicalSonicTwinPromotionVerdictV1 {
  const reasons: string[] = [];
  if (policy.freezeState !== "frozen" || !policy.preregisteredBeforeEvaluation || thresholdMissing(policy)) {
    reasons.push("physical Sonic Twin promotion policy is an unfrozen preregistration template");
    return {
      verdictVersion: "physical-sonic-twin-promotion-verdict-1",
      policyVersion: "physical-sonic-twin-promotion-policy-1",
      freezeState: policy.freezeState,
      productEligible: false,
      promoted: false,
      reasons,
    };
  }

  if (!metrics.specimenDisjoint) reasons.push("physical promotion requires specimen-disjoint held-out evaluation");
  if (policy.evaluationPopulation !== null && metrics.evaluationPopulation !== policy.evaluationPopulation) {
    reasons.push("held-out metrics population does not match the frozen policy population");
  }
  if (policy.minimumHeldOutSpecimenCount !== null && metrics.heldOutSpecimenCount < policy.minimumHeldOutSpecimenCount) {
    reasons.push("held-out specimen count is below the frozen policy");
  }
  if (policy.minimumHeldOutQueryCount !== null && metrics.heldOutQueryCount < policy.minimumHeldOutQueryCount) {
    reasons.push("held-out query count is below the frozen policy");
  }
  if (policy.minimumStationCount !== null && metrics.stationCount < policy.minimumStationCount) {
    reasons.push("station diversity is below the frozen policy");
  }
  if (policy.minimumCoverage !== null && metrics.coverage < policy.minimumCoverage) {
    reasons.push("coverage is below the frozen policy");
  }
  if (policy.maximumFalseMatchRate !== null && (metrics.falseMatchRate === null || metrics.falseMatchRate > policy.maximumFalseMatchRate)) {
    reasons.push("false-match rate is missing or above the frozen policy");
  }
  if (policy.minimumTrueNegativeRate !== null && (metrics.trueNegativeRate === null || metrics.trueNegativeRate < policy.minimumTrueNegativeRate)) {
    reasons.push("nonmatch true-negative rate is missing or below the frozen policy");
  }
  if (policy.maximumBrierScore !== null && (metrics.brierScore === null || metrics.brierScore > policy.maximumBrierScore)) {
    reasons.push("Brier score is missing or above the frozen policy");
  }
  if (policy.maximumEce !== null && (metrics.ece === null || metrics.ece > policy.maximumEce)) {
    reasons.push("ECE is missing or above the frozen policy");
  }
  if (policy.minimumRecallAt1 !== null && (metrics.recallAt1 === null || metrics.recallAt1 < policy.minimumRecallAt1)) {
    reasons.push("Recall@1 is missing or below the frozen policy");
  }

  const productEligible = reasons.length === 0;
  return {
    verdictVersion: "physical-sonic-twin-promotion-verdict-1",
    policyVersion: "physical-sonic-twin-promotion-policy-1",
    freezeState: policy.freezeState,
    productEligible,
    promoted: productEligible,
    reasons,
  };
}
