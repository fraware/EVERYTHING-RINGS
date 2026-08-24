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
