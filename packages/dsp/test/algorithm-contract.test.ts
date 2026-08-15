import { describe, expect, it } from "vitest";
import {
  CURRENT_ACOUSTIC_FINGERPRINT_ALGORITHM_VERSION,
  DEFAULT_ANALYSIS_CONFIG_V1,
} from "../src";

describe("er-dsp-2 canonical parameter contract", () => {
  it("requires an explicit version change when canonical estimator parameters change", () => {
    expect(CURRENT_ACOUSTIC_FINGERPRINT_ALGORITHM_VERSION).toBe("er-dsp-2");
    expect(DEFAULT_ANALYSIS_CONFIG_V1).toEqual({
      stft: {
        fftSize: 8192,
        hopSize: 512,
      },
      peaks: {
        minimumFrequencyHz: 80,
        maximumFrequencyHz: 12_000,
        minimumProminenceDb: 8,
        neighborhoodBins: 12,
        exclusionBins: 2,
      },
      tracking: {
        maximumDistanceCents: 25,
        minimumDistanceHz: 3,
        maximumMissedFrames: 2,
      },
      trackAcceptance: {
        minimumObservations: 8,
        minimumDurationSeconds: 0.08,
        maximumFrequencyStdCents: 18,
      },
      decay: {
        minimumObservations: 6,
        minimumTailProminenceDb: 6,
        robustLine: {
          huberDelta: 1.345,
          maximumIterations: 20,
          convergenceTolerance: 1e-9,
        },
      },
      confidence: {
        minimumProminenceDb: 8,
        fullProminenceDb: 24,
        minimumPersistenceSeconds: 0.08,
        fullPersistenceSeconds: 0.5,
        maximumFrequencyStdCents: 18,
        prominenceWeight: 0.3,
        decayWeight: 0.25,
        persistenceWeight: 0.25,
        frequencyStabilityWeight: 0.2,
      },
      selection: {
        minimumConfidence: 0.55,
        minimumRelativeAmplitude: 0.001,
        maximumModes: 16,
        duplicateDistanceCents: 12,
      },
      minimumModes: 3,
    });
  });
});
