import type { AcousticModeDiagnostics } from "./types";

export interface ModeConfidenceConfig {
  readonly minimumProminenceDb: number;
  readonly fullProminenceDb: number;
  readonly minimumPersistenceSeconds: number;
  readonly fullPersistenceSeconds: number;
  readonly maximumFrequencyStdCents: number;
  readonly prominenceWeight: number;
  readonly decayWeight: number;
  readonly persistenceWeight: number;
  readonly frequencyStabilityWeight: number;
}

export const DEFAULT_MODE_CONFIDENCE_CONFIG: ModeConfidenceConfig = {
  minimumProminenceDb: 8,
  fullProminenceDb: 24,
  minimumPersistenceSeconds: 0.08,
  fullPersistenceSeconds: 0.5,
  maximumFrequencyStdCents: 18,
  prominenceWeight: 0.3,
  decayWeight: 0.25,
  persistenceWeight: 0.25,
  frequencyStabilityWeight: 0.2,
};

function unitInterval(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function mapRange(value: number, minimum: number, full: number): number {
  if (!(full > minimum)) throw new RangeError("Confidence score range must have full > minimum");
  return unitInterval((value - minimum) / (full - minimum));
}

export function modeConfidence(
  diagnostics: AcousticModeDiagnostics,
  config: ModeConfidenceConfig = DEFAULT_MODE_CONFIDENCE_CONFIG,
): number {
  const weightSum =
    config.prominenceWeight +
    config.decayWeight +
    config.persistenceWeight +
    config.frequencyStabilityWeight;
  if (!(weightSum > 0)) throw new RangeError("Mode confidence weights must sum to a positive value");

  const prominence = mapRange(
    diagnostics.prominenceDb,
    config.minimumProminenceDb,
    config.fullProminenceDb,
  );
  const decay = unitInterval(diagnostics.decayFitScore);
  const persistence = mapRange(
    diagnostics.persistenceSeconds,
    config.minimumPersistenceSeconds,
    config.fullPersistenceSeconds,
  );
  const frequencyStability = unitInterval(
    1 - diagnostics.frequencyStdCents / config.maximumFrequencyStdCents,
  );

  return (
    config.prominenceWeight * prominence +
    config.decayWeight * decay +
    config.persistenceWeight * persistence +
    config.frequencyStabilityWeight * frequencyStability
  ) / weightSum;
}
