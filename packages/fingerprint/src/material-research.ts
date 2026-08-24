import type { AcousticObjectModelV1 } from "./object-model";

export interface MaterialTrainingExampleV1 {
  readonly exampleId: string;
  readonly materialLabel: string;
  readonly model: AcousticObjectModelV1;
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
}

export interface MaterialBenchmarkMetricsV1 {
  readonly exampleCount: number;
  readonly coveredCount: number;
  readonly abstainedCount: number;
  readonly coverage: number;
  readonly coveredAccuracy: number | null;
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
  for (const example of examples) {
    const prediction = predictMaterialResearch(model, example.model, minimumDistanceMargin);
    if (prediction.decision === "abstain" || prediction.materialLabel === null) continue;
    covered += 1;
    if (prediction.materialLabel === example.trueMaterialLabel) correct += 1;
    else errors.push({ exampleId: example.exampleId, expected: example.trueMaterialLabel, predicted: prediction.materialLabel });
  }
  return {
    exampleCount: examples.length,
    coveredCount: covered,
    abstainedCount: examples.length - covered,
    coverage: examples.length === 0 ? 0 : covered / examples.length,
    coveredAccuracy: covered === 0 ? null : correct / covered,
    errors,
  };
}
