import {
  estimateDampedModesPronyResearch,
  type PronyResearchResultV1,
} from "./prony-research";

/**
 * Documented research-only damped-mode estimators.
 *
 * These are not AcousticFingerprintV1 producers, never stamp
 * `algorithmVersion`, and are never evidence-eligible. Promotion to a
 * canonical `er-dsp-*` version requires the protocol in docs/DSP.md.
 * This module does not introduce a new fingerprint algorithm version.
 */
export const RESEARCH_DAMPED_MODE_ESTIMATOR_IDS = ["prony-damped-modes-research-1"] as const;
export type ResearchDampedModeEstimatorId = (typeof RESEARCH_DAMPED_MODE_ESTIMATOR_IDS)[number];

export function isResearchDampedModeEstimatorId(value: unknown): value is ResearchDampedModeEstimatorId {
  return typeof value === "string"
    && (RESEARCH_DAMPED_MODE_ESTIMATOR_IDS as readonly string[]).includes(value);
}

export function estimateDampedModesWithResearchEstimator(
  estimatorId: ResearchDampedModeEstimatorId,
  samples: readonly number[],
  sampleRate: number,
  modeCount: number,
): PronyResearchResultV1 {
  switch (estimatorId) {
    case "prony-damped-modes-research-1":
      return estimateDampedModesPronyResearch(samples, sampleRate, modeCount);
    default: {
      const exhaustive: never = estimatorId;
      throw new Error(`unsupported research estimator ${String(exhaustive)}`);
    }
  }
}
