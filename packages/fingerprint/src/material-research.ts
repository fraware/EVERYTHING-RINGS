import type { AcousticObjectModelV1 } from "./object-model";
import { specimenDisjointSplit, type BenchmarkSplit } from "./nuisance";

export type MaterialAssertionSourceV1 =
  | "manufacturer"
  | "inspection"
  | "expert"
  | "self-declared"
  | "inferred"
  | "unknown";

export type MaterialAssertionConfidenceClassV1 = "verified" | "declared" | "uncertain" | "inferred";

/**
 * Thin fingerprint-local provenance record compatible with the takeover
 * MaterialAssertionV1 shape. Fingerprint does not depend on validation.
 */
export interface MaterialAssertionV1 {
  readonly assertionVersion: "material-assertion-1";
  readonly materialLabel: string;
  readonly source: MaterialAssertionSourceV1;
  readonly sourceReference: string | null;
  readonly confidenceClass: MaterialAssertionConfidenceClassV1;
  readonly algorithmDerivationId: string | null;
}

const VERIFIED_MATERIAL_SOURCES: ReadonlySet<MaterialAssertionSourceV1> = new Set([
  "manufacturer",
  "inspection",
  "expert",
]);

export function isVerifiedMaterialAssertion(assertion: MaterialAssertionV1): boolean {
  return assertion.confidenceClass === "verified" || VERIFIED_MATERIAL_SOURCES.has(assertion.source);
}

export function isInferredMaterialAssertion(assertion: MaterialAssertionV1): boolean {
  return assertion.source === "inferred" || assertion.confidenceClass === "inferred";
}

export function createMaterialAssertion(
  input: Omit<MaterialAssertionV1, "assertionVersion">,
): MaterialAssertionV1 {
  const materialLabel = input.materialLabel.trim();
  if (materialLabel.length === 0) throw new Error("material assertion materialLabel is required");
  if (input.source === "inferred") {
    if (input.confidenceClass !== "inferred") {
      throw new Error("inferred material source must use confidenceClass inferred");
    }
    if (input.algorithmDerivationId === null || input.algorithmDerivationId.trim().length === 0) {
      throw new Error("inferred material labels must carry an inference derivation id");
    }
  }
  if (VERIFIED_MATERIAL_SOURCES.has(input.source) && input.confidenceClass === "inferred") {
    throw new Error("verified material sources cannot be marked inferred");
  }
  return {
    assertionVersion: "material-assertion-1",
    materialLabel,
    source: input.source,
    sourceReference: input.sourceReference === null ? null : input.sourceReference.trim(),
    confidenceClass: input.confidenceClass,
    algorithmDerivationId: input.algorithmDerivationId === null ? null : input.algorithmDerivationId.trim(),
  };
}

export function assignMaterialAssertion(
  existing: MaterialAssertionV1 | null,
  incoming: MaterialAssertionV1,
): MaterialAssertionV1 {
  if (existing !== null && isVerifiedMaterialAssertion(existing) && isInferredMaterialAssertion(incoming)) {
    throw new Error("inferred material labels must not overwrite verified truth");
  }
  return incoming;
}

export interface MaterialTrainingExampleV1 {
  readonly exampleId: string;
  readonly materialLabel: string;
  readonly model: AcousticObjectModelV1;
  readonly materialAssertion?: MaterialAssertionV1;
  readonly objectFamily?: string;
  readonly specimenId?: string;
}

export interface MaterialCentroidV1 {
  readonly materialLabel: string;
  readonly exampleCount: number;
  readonly featureCentroid: readonly number[];
}

export interface MaterialInferenceModelV1 {
  readonly schemaVersion: 1;
  readonly materialInferenceVersion: "material-centroid-research-1";
  readonly evidenceEligible: false;
  readonly trainingPopulation: string;
  readonly featureVersion: "modal-summary-features-1";
  readonly featureDimension: number;
  readonly centroids: readonly MaterialCentroidV1[];
}

const MAX_MODES = 8;

function modelFeatures(model: AcousticObjectModelV1): number[] {
  const modes = [...model.modes].sort((left, right) => left.frequencyHzMedian - right.frequencyHzMedian).slice(0, MAX_MODES);
  const anchor = modes[0]?.frequencyHzMedian ?? 1;
  const features: number[] = [Math.min(1, modes.length / MAX_MODES)];
  for (let index = 0; index < MAX_MODES; index += 1) {
    const mode = modes[index];
    if (mode === undefined) {
      features.push(0, 0, 0, 0);
      continue;
    }
    features.push(
      Math.log2(Math.max(mode.frequencyHzMedian / anchor, 1e-9)) / 8,
      Math.log(Math.max(mode.decaySecondsMedian, 1e-9)) / 8,
      Math.log10(Math.max(mode.relativeAmplitudeMedian, 1e-9)) / 4,
      mode.observationSupportFraction,
    );
  }
  return features;
}

function distance(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length) throw new Error("material feature dimensions differ");
  let squared = 0;
  for (let index = 0; index < left.length; index += 1) squared += (left[index]! - right[index]!) ** 2;
  return Math.sqrt(squared / Math.max(1, left.length));
}

export function fitMaterialCentroidResearch(
  examples: readonly MaterialTrainingExampleV1[],
  trainingPopulation: string,
): MaterialInferenceModelV1 {
  if (examples.length === 0) throw new Error("material research model requires examples");
  if (trainingPopulation.trim().length === 0) throw new Error("material trainingPopulation is required");
  const seen = new Set<string>();
  const grouped = new Map<string, number[][]>();
  for (const example of examples) {
    if (example.exampleId.trim().length === 0) throw new Error("material exampleId is required");
    if (seen.has(example.exampleId)) throw new Error(`duplicate material exampleId ${example.exampleId}`);
    seen.add(example.exampleId);
    const label = example.materialLabel.trim();
    if (label.length === 0) throw new Error("materialLabel is required");
    if (example.materialAssertion !== undefined) {
      if (example.materialAssertion.materialLabel !== label) {
        throw new Error(`material example ${example.exampleId} materialLabel does not match materialAssertion`);
      }
    }
    const group = grouped.get(label) ?? [];
    group.push(modelFeatures(example.model));
    grouped.set(label, group);
  }
  if (grouped.size < 2) throw new Error("material research model requires at least two material labels");
  const featureDimension = modelFeatures(examples[0]!.model).length;
  const centroids = [...grouped.entries()].map(([materialLabel, features]) => ({
    materialLabel,
    exampleCount: features.length,
    featureCentroid: Array.from({ length: featureDimension }, (_, index) => features.reduce((sum, row) => sum + row[index]!, 0) / features.length),
  })).sort((left, right) => left.materialLabel.localeCompare(right.materialLabel));
  return {
    schemaVersion: 1,
    materialInferenceVersion: "material-centroid-research-1",
    evidenceEligible: false,
    trainingPopulation: trainingPopulation.trim(),
    featureVersion: "modal-summary-features-1",
    featureDimension,
    centroids,
  };
}

export interface MaterialPredictionV1 {
  readonly predictionVersion: "material-centroid-prediction-1";
  readonly decision: "label" | "abstain";
  readonly materialLabel: string | null;
  readonly nearestDistance: number;
  readonly secondDistance: number | null;
  readonly distanceMargin: number | null;
  readonly trainingPopulation: string;
  readonly calibratedProbability: null;
}

export function predictMaterialResearch(
  model: MaterialInferenceModelV1,
  objectModel: AcousticObjectModelV1,
  minimumDistanceMargin = 0.03,
): MaterialPredictionV1 {
  if (!(minimumDistanceMargin >= 0) || !Number.isFinite(minimumDistanceMargin)) throw new Error("minimumDistanceMargin must be finite and non-negative");
  const features = modelFeatures(objectModel);
  const ranked = model.centroids
    .map((centroid) => ({ materialLabel: centroid.materialLabel, distance: distance(features, centroid.featureCentroid) }))
    .sort((left, right) => left.distance - right.distance || left.materialLabel.localeCompare(right.materialLabel));
  const nearest = ranked[0];
  if (nearest === undefined) throw new Error("material model has no centroids");
  const second = ranked[1];
  const margin = second === undefined ? null : second.distance - nearest.distance;
  const decision = margin !== null && margin >= minimumDistanceMargin ? "label" as const : "abstain" as const;
  return {
    predictionVersion: "material-centroid-prediction-1",
    decision,
    materialLabel: decision === "label" ? nearest.materialLabel : null,
    nearestDistance: nearest.distance,
    secondDistance: second?.distance ?? null,
    distanceMargin: margin,
    trainingPopulation: model.trainingPopulation,
    calibratedProbability: null,
  };
}

export interface MaterialBenchmarkExampleV1 {
  readonly exampleId: string;
  readonly trueMaterialLabel: string;
  readonly model: AcousticObjectModelV1;
  readonly materialAssertion?: MaterialAssertionV1;
  readonly objectFamily?: string;
  readonly specimenId?: string;
}

export interface MaterialClassMetricV1 {
  readonly materialLabel: string;
  readonly support: number;
  readonly predictedCount: number;
  readonly truePositiveCount: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
}

export interface MaterialBenchmarkMetricsV1 {
  readonly exampleCount: number;
  readonly coveredCount: number;
  readonly abstainedCount: number;
  readonly coverage: number;
  readonly coveredAccuracy: number | null;
  readonly macroF1: number | null;
  readonly balancedAccuracy: number | null;
  readonly perClass: readonly MaterialClassMetricV1[];
  readonly errors: readonly { readonly exampleId: string; readonly expected: string; readonly predicted: string }[];
}

export function benchmarkMaterialResearch(
  model: MaterialInferenceModelV1,
  examples: readonly MaterialBenchmarkExampleV1[],
  minimumDistanceMargin = 0.03,
): MaterialBenchmarkMetricsV1 {
  const errors: Array<{ exampleId: string; expected: string; predicted: string }> = [];
  let covered = 0;
  let correct = 0;
  const labels = new Set<string>();
  const truePositives = new Map<string, number>();
  const predictedCounts = new Map<string, number>();
  const supportCounts = new Map<string, number>();
  const increment = (map: Map<string, number>, key: string): void => {
    map.set(key, (map.get(key) ?? 0) + 1);
  };

  for (const example of examples) {
    if (example.materialAssertion !== undefined) {
      if (isVerifiedMaterialAssertion(example.materialAssertion) && example.materialAssertion.materialLabel !== example.trueMaterialLabel) {
        throw new Error(`benchmark example ${example.exampleId} trueMaterialLabel does not match verified material assertion`);
      }
    }
    const truth = example.trueMaterialLabel.trim();
    labels.add(truth);
    increment(supportCounts, truth);
    const prediction = predictMaterialResearch(model, example.model, minimumDistanceMargin);
    if (prediction.decision === "abstain" || prediction.materialLabel === null) continue;
    covered += 1;
    labels.add(prediction.materialLabel);
    increment(predictedCounts, prediction.materialLabel);
    if (prediction.materialLabel === truth) {
      correct += 1;
      increment(truePositives, truth);
    } else {
      errors.push({ exampleId: example.exampleId, expected: truth, predicted: prediction.materialLabel });
    }
  }

  const perClass = [...labels].sort((left, right) => left.localeCompare(right, "en-US")).map((materialLabel): MaterialClassMetricV1 => {
    const support = supportCounts.get(materialLabel) ?? 0;
    const predictedCount = predictedCounts.get(materialLabel) ?? 0;
    const truePositiveCount = truePositives.get(materialLabel) ?? 0;
    const precision = predictedCount === 0 ? 0 : truePositiveCount / predictedCount;
    const recall = support === 0 ? 0 : truePositiveCount / support;
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return { materialLabel, support, predictedCount, truePositiveCount, precision, recall, f1 };
  });

  return {
    exampleCount: examples.length,
    coveredCount: covered,
    abstainedCount: examples.length - covered,
    coverage: examples.length === 0 ? 0 : covered / examples.length,
    coveredAccuracy: covered === 0 ? null : correct / covered,
    macroF1: perClass.length === 0 ? null : perClass.reduce((sum, row) => sum + row.f1, 0) / perClass.length,
    balancedAccuracy: perClass.length === 0 ? null : perClass.reduce((sum, row) => sum + row.recall, 0) / perClass.length,
    perClass,
    errors,
  };
}

export interface MaterialLabeledExampleV1 {
  readonly exampleId: string;
  readonly specimenId: string;
  readonly objectFamily: string;
  readonly assertion: MaterialAssertionV1;
  readonly model: AcousticObjectModelV1;
}

export function familyDisjointSplit(objectFamily: string): BenchmarkSplit {
  return specimenDisjointSplit(objectFamily);
}

export function materialExamplesEligibleForTraining(
  examples: readonly MaterialLabeledExampleV1[],
): MaterialLabeledExampleV1[] {
  return examples.filter((example) => !isInferredMaterialAssertion(example.assertion));
}

export function partitionMaterialExamplesByFamily(
  examples: readonly MaterialLabeledExampleV1[],
  split: (objectFamily: string) => BenchmarkSplit = familyDisjointSplit,
): {
  readonly train: readonly MaterialLabeledExampleV1[];
  readonly validation: readonly MaterialLabeledExampleV1[];
  readonly test: readonly MaterialLabeledExampleV1[];
} {
  const train: MaterialLabeledExampleV1[] = [];
  const validation: MaterialLabeledExampleV1[] = [];
  const test: MaterialLabeledExampleV1[] = [];
  const familySplit = new Map<string, BenchmarkSplit>();
  for (const example of examples) {
    const family = example.objectFamily.trim().toLocaleLowerCase("en-US");
    if (family.length === 0) throw new Error(`material example ${example.exampleId} has empty objectFamily`);
    const assigned = familySplit.get(family) ?? split(family);
    const prior = familySplit.get(family);
    if (prior !== undefined && prior !== assigned) {
      throw new Error(`object family ${example.objectFamily} leaks across material benchmark splits`);
    }
    familySplit.set(family, assigned);
    if (assigned === "train") train.push(example);
    else if (assigned === "validation") validation.push(example);
    else test.push(example);
  }
  return { train, validation, test };
}

export interface MaterialFamilyDisjointEvaluationV1 {
  readonly evaluationVersion: "material-family-disjoint-evaluation-1";
  readonly evidenceEligible: false;
  readonly trainingPopulation: string;
  readonly trainFamilyCount: number;
  readonly evaluationFamilyCount: number;
  readonly metrics: MaterialBenchmarkMetricsV1;
}

function toTrainingExample(example: MaterialLabeledExampleV1): MaterialTrainingExampleV1 {
  return {
    exampleId: example.exampleId,
    materialLabel: example.assertion.materialLabel,
    model: example.model,
    materialAssertion: example.assertion,
    objectFamily: example.objectFamily,
    specimenId: example.specimenId,
  };
}

function toBenchmarkExample(example: MaterialLabeledExampleV1): MaterialBenchmarkExampleV1 {
  return {
    exampleId: example.exampleId,
    trueMaterialLabel: example.assertion.materialLabel,
    model: example.model,
    materialAssertion: example.assertion,
    objectFamily: example.objectFamily,
    specimenId: example.specimenId,
  };
}

export function fitAndBenchmarkMaterialFamilyDisjoint(
  examples: readonly MaterialLabeledExampleV1[],
  trainingPopulation: string,
  minimumDistanceMargin = 0.03,
  split: (objectFamily: string) => BenchmarkSplit = familyDisjointSplit,
): MaterialFamilyDisjointEvaluationV1 {
  const eligible = materialExamplesEligibleForTraining(examples);
  const partitioned = partitionMaterialExamplesByFamily(eligible, split);
  const evaluation = [...partitioned.validation, ...partitioned.test];
  const fitted = fitMaterialCentroidResearch(partitioned.train.map(toTrainingExample), trainingPopulation);
  return {
    evaluationVersion: "material-family-disjoint-evaluation-1",
    evidenceEligible: false,
    trainingPopulation: trainingPopulation.trim(),
    trainFamilyCount: new Set(partitioned.train.map((example) => example.objectFamily.trim().toLocaleLowerCase("en-US"))).size,
    evaluationFamilyCount: new Set(evaluation.map((example) => example.objectFamily.trim().toLocaleLowerCase("en-US"))).size,
    metrics: benchmarkMaterialResearch(fitted, evaluation.map(toBenchmarkExample), minimumDistanceMargin),
  };
}
