import { buildReleaseVerdictForRevision } from "./current-release";
import { evaluateCanonicalGateB, evaluateCanonicalGateC, type GateBPlanV1, type GateCPlanV1 } from "./review-plans";
import type { EmpiricalCampaignProgress } from "./campaign";
import type { GateBReview, GateCReview, ReleaseVerdict, ValidationEvidenceV5 } from "./types";

export interface CanonicalReleaseVerdictV1 {
  readonly schemaVersion: 1;
  readonly canonicalReleaseContractVersion: "canonical-release-1";
  readonly createdAt: string;
  readonly authorizedSoftwareRevision: string;
  readonly base: ReleaseVerdict;
  readonly campaignAccounted: boolean;
  readonly gateBPlanPresent: boolean;
  readonly gateCPlanPresent: boolean;
  readonly gateB: ReturnType<typeof evaluateCanonicalGateB> | null;
  readonly gateC: ReturnType<typeof evaluateCanonicalGateC> | null;
  readonly releaseReady: boolean;
  readonly reasons: readonly string[];
}

export function buildCanonicalReleaseVerdictForRevision(
  evidence: readonly ValidationEvidenceV5[],
  gateBReviews: readonly GateBReview[],
  gateCReviews: readonly GateCReview[],
  createdAt: string,
  expectedSoftwareRevision: string,
  campaignProgress: EmpiricalCampaignProgress | undefined,
  gateBPlan: GateBPlanV1 | undefined,
  gateCPlan: GateCPlanV1 | undefined,
): CanonicalReleaseVerdictV1 {
  const base = buildReleaseVerdictForRevision(
    evidence,
    gateBReviews,
    gateCReviews,
    createdAt,
    expectedSoftwareRevision,
  );
  const reasons: string[] = [];
  const campaignAccounted = campaignProgress?.collectionComplete === true;
  if (!campaignAccounted) reasons.push("the complete precommitted empirical campaign is not accounted for");
  if (!base.gateA.passed) reasons.push("Gate A2 has not passed under the authorized revision");
  if (gateBPlan === undefined) reasons.push("canonical Gate B plan is missing");
  if (gateCPlan === undefined) reasons.push("canonical Gate C plan is missing");

  const gateB = gateBPlan === undefined
    ? null
    : evaluateCanonicalGateB(gateBPlan, base.gateA, gateBReviews);
  if (gateB !== null && !gateB.passed) reasons.push(...gateB.reasons.map((reason) => `Gate B: ${reason}`));

  const gateC = gateCPlan === undefined || gateB === null
    ? null
    : evaluateCanonicalGateC(gateCPlan, gateB.verdict, gateCReviews);
  if (gateC !== null && !gateC.passed) reasons.push(...gateC.reasons.map((reason) => `Gate C: ${reason}`));

  const releaseReady = campaignAccounted
    && base.gateA.passed
    && gateB?.passed === true
    && gateC?.passed === true;

  return {
    schemaVersion: 1,
    canonicalReleaseContractVersion: "canonical-release-1",
    createdAt,
    authorizedSoftwareRevision: expectedSoftwareRevision,
    base,
    campaignAccounted,
    gateBPlanPresent: gateBPlan !== undefined,
    gateCPlanPresent: gateCPlan !== undefined,
    gateB,
    gateC,
    releaseReady,
    reasons: [...new Set(reasons)],
  };
}
