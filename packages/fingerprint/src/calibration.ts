export interface LabeledSimilarityScoreV1 {
  readonly pairId: string;
  readonly score: number;
  readonly samePhysicalSpecimen: boolean;
}

export interface IsotonicCalibrationBinV1 {
  readonly minimumScore: number;
  readonly maximumScore: number;
  readonly sampleCount: number;
  readonly positiveCount: number;
  readonly probability: number;
}

export interface SonicTwinCalibrationModelV1 {
  readonly schemaVersion: 1;
  readonly calibrationVersion: "sonic-twin-isotonic-calibration-1";
  readonly trainingPopulation: string;
  readonly labelSemantics: "same-physical-specimen";
  readonly trainingSampleCount: number;
  readonly trainingPositiveCount: number;
  readonly bins: readonly IsotonicCalibrationBinV1[];
}

interface MutableBlock {
  minimumScore: number;
  maximumScore: number;
  sampleCount: number;
  positiveCount: number;
}

function assertScore(score: number): void {
  if (!Number.isFinite(score)) throw new Error("similarity score must be finite");
}

function blockProbability(block: MutableBlock): number {
  return block.positiveCount / block.sampleCount;
}

function assertBinarySupport(samples: readonly LabeledSimilarityScoreV1[], label: string): void {
  if (!samples.some((sample) => sample.samePhysicalSpecimen)) throw new Error(`${label} requires at least one positive example`);
  if (!samples.some((sample) => !sample.samePhysicalSpecimen)) throw new Error(`${label} requires at least one negative example`);
}

export function fitIsotonicCalibration(
  samples: readonly LabeledSimilarityScoreV1[],
  trainingPopulation: string,
): SonicTwinCalibrationModelV1 {
  if (samples.length === 0) throw new Error("calibration requires labeled samples");
  if (trainingPopulation.trim().length === 0) throw new Error("calibration trainingPopulation is required");
  const seen = new Set<string>();
  for (const sample of samples) {
    assertScore(sample.score);
    if (sample.pairId.trim().length === 0) throw new Error("calibration pairId is required");
    if (seen.has(sample.pairId)) throw new Error(`duplicate calibration pairId ${sample.pairId}`);
    seen.add(sample.pairId);
  }

  const ordered = [...samples].sort((left, right) => left.score - right.score || left.pairId.localeCompare(right.pairId));
  const blocks: MutableBlock[] = ordered.map((sample) => ({
    minimumScore: sample.score,
    maximumScore: sample.score,
    sampleCount: 1,
    positiveCount: sample.samePhysicalSpecimen ? 1 : 0,
  }));

  let index = 0;
  while (index < blocks.length - 1) {
    if (blockProbability(blocks[index]!) <= blockProbability(blocks[index + 1]!)) {
      index += 1;
      continue;
    }
    const left = blocks[index]!;
    const right = blocks[index + 1]!;
    blocks.splice(index, 2, {
      minimumScore: left.minimumScore,
      maximumScore: right.maximumScore,
      sampleCount: left.sampleCount + right.sampleCount,
      positiveCount: left.positiveCount + right.positiveCount,
    });
    if (index > 0) index -= 1;
  }

  return {
    schemaVersion: 1,
    calibrationVersion: "sonic-twin-isotonic-calibration-1",
    trainingPopulation: trainingPopulation.trim(),
    labelSemantics: "same-physical-specimen",
    trainingSampleCount: samples.length,
    trainingPositiveCount: samples.filter((sample) => sample.samePhysicalSpecimen).length,
    bins: blocks.map((block) => ({ ...block, probability: blockProbability(block) })),
  };
}

export function predictCalibratedProbability(
  model: SonicTwinCalibrationModelV1,
  score: number,
): number {
  assertScore(score);
  if (model.bins.length === 0) throw new Error("calibration model has no bins");
  if (score <= model.bins[0]!.maximumScore) return model.bins[0]!.probability;
  for (let index = 1; index < model.bins.length; index += 1) {
    const previous = model.bins[index - 1]!;
    const current = model.bins[index]!;
    if (score <= current.maximumScore) {
      if (score <= current.minimumScore) {
        const span = current.minimumScore - previous.maximumScore;
        if (!(span > 0)) return current.probability;
        const t = (score - previous.maximumScore) / span;
        return previous.probability + Math.max(0, Math.min(1, t)) * (current.probability - previous.probability);
      }
      return current.probability;
    }
  }
  return model.bins[model.bins.length - 1]!.probability;
}

export interface CalibratedPredictionV1 {
  readonly pairId: string;
  readonly probability: number;
  readonly samePhysicalSpecimen: boolean;
}

export interface CalibrationMetricsV1 {
  readonly sampleCount: number;
  readonly brierScore: number | null;
  readonly expectedCalibrationError: number | null;
  readonly rocAuc: number | null;
}

export function calibratedPredictions(
  model: SonicTwinCalibrationModelV1,
  samples: readonly LabeledSimilarityScoreV1[],
): readonly CalibratedPredictionV1[] {
  return samples.map((sample) => ({
    pairId: sample.pairId,
    probability: predictCalibratedProbability(model, sample.score),
    samePhysicalSpecimen: sample.samePhysicalSpecimen,
  }));
}

function rocAuc(predictions: readonly CalibratedPredictionV1[]): number | null {
  const positives = predictions.filter((prediction) => prediction.samePhysicalSpecimen);
  const negatives = predictions.filter((prediction) => !prediction.samePhysicalSpecimen);
  if (positives.length === 0 || negatives.length === 0) return null;
  let wins = 0;
  for (const positive of positives) {
    for (const negative of negatives) {
      if (positive.probability > negative.probability) wins += 1;
      else if (positive.probability === negative.probability) wins += 0.5;
    }
  }
  return wins / (positives.length * negatives.length);
}

export function evaluateCalibration(
  predictions: readonly CalibratedPredictionV1[],
  binCount = 10,
): CalibrationMetricsV1 {
  if (!Number.isInteger(binCount) || binCount <= 0) throw new Error("calibration binCount must be a positive integer");
  if (predictions.length === 0) return { sampleCount: 0, brierScore: null, expectedCalibrationError: null, rocAuc: null };
  let squared = 0;
  for (const prediction of predictions) {
    if (!(prediction.probability >= 0 && prediction.probability <= 1) || !Number.isFinite(prediction.probability)) {
      throw new Error("calibrated probability must be finite and in [0,1]");
    }
    const label = prediction.samePhysicalSpecimen ? 1 : 0;
    squared += (prediction.probability - label) ** 2;
  }

  let ece = 0;
  for (let bin = 0; bin < binCount; bin += 1) {
    const lower = bin / binCount;
    const upper = (bin + 1) / binCount;
    const members = predictions.filter((prediction) => prediction.probability >= lower && (bin === binCount - 1 ? prediction.probability <= upper : prediction.probability < upper));
    if (members.length === 0) continue;
    const meanProbability = members.reduce((sum, member) => sum + member.probability, 0) / members.length;
    const positiveRate = members.filter((member) => member.samePhysicalSpecimen).length / members.length;
    ece += members.length / predictions.length * Math.abs(meanProbability - positiveRate);
  }

  return {
    sampleCount: predictions.length,
    brierScore: squared / predictions.length,
    expectedCalibrationError: ece,
    rocAuc: rocAuc(predictions),
  };
}

export interface RiskCoveragePointV1 {
  readonly minimumConfidence: number;
  readonly coverage: number;
  readonly errorRate: number | null;
  readonly coveredCount: number;
}

export function riskCoverageCurve(
  predictions: readonly CalibratedPredictionV1[],
  thresholds: readonly number[] = [0, 0.1, 0.2, 0.3, 0.4, 0.49],
): readonly RiskCoveragePointV1[] {
  return thresholds.map((minimumConfidence) => {
    if (!(minimumConfidence >= 0 && minimumConfidence <= 0.5) || !Number.isFinite(minimumConfidence)) {
      throw new Error("minimumConfidence must be finite and in [0,0.5]");
    }
    const covered = predictions.filter((prediction) => Math.abs(prediction.probability - 0.5) >= minimumConfidence);
    const errors = covered.filter((prediction) => (prediction.probability >= 0.5) !== prediction.samePhysicalSpecimen).length;
    return {
      minimumConfidence,
      coverage: predictions.length === 0 ? 0 : covered.length / predictions.length,
      errorRate: covered.length === 0 ? null : errors / covered.length,
      coveredCount: covered.length,
    };
  });
}

export type CalibrationPartition = "calibration" | "evaluation";

export interface PartitionedSimilarityScoreV1 extends LabeledSimilarityScoreV1 {
  readonly groupId: string;
  readonly partition: CalibrationPartition;
}

export interface HeldOutCalibrationEvaluationV1 {
  readonly schemaVersion: 1;
  readonly evaluationVersion: "sonic-twin-held-out-calibration-1";
  readonly calibrationPopulation: string;
  readonly evaluationPopulation: string;
  readonly calibrationGroups: readonly string[];
  readonly evaluationGroups: readonly string[];
  readonly calibrationSampleCount: number;
  readonly evaluationSampleCount: number;
  readonly model: SonicTwinCalibrationModelV1;
  readonly predictions: readonly CalibratedPredictionV1[];
  readonly metrics: CalibrationMetricsV1;
  readonly riskCoverage: readonly RiskCoveragePointV1[];
}

/**
 * Fits probability calibration only on the calibration partition and reports
 * metrics only on group-disjoint evaluation samples. A group is normally a
 * physical specimen or held-out query identity; it may not cross partitions.
 */
export function fitAndEvaluateHeldOutCalibration(
  samples: readonly PartitionedSimilarityScoreV1[],
  calibrationPopulation: string,
  evaluationPopulation: string,
  binCount = 10,
  riskThresholds: readonly number[] = [0, 0.1, 0.2, 0.3, 0.4, 0.49],
): HeldOutCalibrationEvaluationV1 {
  if (calibrationPopulation.trim().length === 0 || evaluationPopulation.trim().length === 0) {
    throw new Error("held-out calibration requires named calibration and evaluation populations");
  }
  const seenPairIds = new Set<string>();
  const calibrationGroups = new Set<string>();
  const evaluationGroups = new Set<string>();
  for (const sample of samples) {
    assertScore(sample.score);
    if (sample.pairId.trim().length === 0 || sample.groupId.trim().length === 0) throw new Error("held-out calibration requires pairId and groupId");
    if (seenPairIds.has(sample.pairId)) throw new Error(`duplicate held-out calibration pairId ${sample.pairId}`);
    seenPairIds.add(sample.pairId);
    const group = sample.groupId.trim().toLocaleLowerCase("en-US");
    (sample.partition === "calibration" ? calibrationGroups : evaluationGroups).add(group);
  }
  for (const group of calibrationGroups) {
    if (evaluationGroups.has(group)) throw new Error(`calibration leakage: group ${group} appears in both partitions`);
  }

  const calibrationSamples = samples.filter((sample) => sample.partition === "calibration");
  const evaluationSamples = samples.filter((sample) => sample.partition === "evaluation");
  if (calibrationSamples.length === 0 || evaluationSamples.length === 0) throw new Error("held-out calibration requires non-empty calibration and evaluation partitions");
  assertBinarySupport(calibrationSamples, "calibration partition");
  assertBinarySupport(evaluationSamples, "evaluation partition");

  const strip = (sample: PartitionedSimilarityScoreV1): LabeledSimilarityScoreV1 => ({
    pairId: sample.pairId,
    score: sample.score,
    samePhysicalSpecimen: sample.samePhysicalSpecimen,
  });
  const model = fitIsotonicCalibration(calibrationSamples.map(strip), calibrationPopulation);
  const predictions = calibratedPredictions(model, evaluationSamples.map(strip));
  return {
    schemaVersion: 1,
    evaluationVersion: "sonic-twin-held-out-calibration-1",
    calibrationPopulation: calibrationPopulation.trim(),
    evaluationPopulation: evaluationPopulation.trim(),
    calibrationGroups: [...calibrationGroups].sort(),
    evaluationGroups: [...evaluationGroups].sort(),
    calibrationSampleCount: calibrationSamples.length,
    evaluationSampleCount: evaluationSamples.length,
    model,
    predictions,
    metrics: evaluateCalibration(predictions, binCount),
    riskCoverage: riskCoverageCurve(predictions, riskThresholds),
  };
}
