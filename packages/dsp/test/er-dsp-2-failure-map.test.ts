import { describe, expect, it } from "vitest";
import { generateModalSignal } from "../../fixtures/src/index";
import {
  CURRENT_ACOUSTIC_FINGERPRINT_ALGORITHM_VERSION,
  compileErDsp2FailureMapReport,
  ER_DSP_2_FAILURE_MAP_REGIMES,
  estimateDampedModesWithResearchEstimator,
  evaluateErDsp2SyntheticFailureMapCase,
} from "../src";

const SAMPLE_RATE = 48_000;

function caseFor(
  regimeId: (typeof ER_DSP_2_FAILURE_MAP_REGIMES)[number],
  modes: readonly { frequencyHz: number; amplitude: number; decaySeconds: number }[],
  extras?: { durationSeconds?: number; noiseAmplitude?: number; seed?: number },
) {
  const samples = generateModalSignal({
    sampleRate: SAMPLE_RATE,
    durationSeconds: extras?.durationSeconds ?? 2.5,
    modes,
    noiseAmplitude: extras?.noiseAmplitude,
    seed: extras?.seed,
  });
  return evaluateErDsp2SyntheticFailureMapCase({
    regimeId,
    samples,
    sampleRate: SAMPLE_RATE,
    trueModes: modes.map((mode) => ({ frequencyHz: mode.frequencyHz, decaySeconds: mode.decaySeconds })),
  });
}

describe("er-dsp-2 synthetic failure map", () => {
  it("keeps the mapped algorithm on the frozen evidence-eligible version", () => {
    expect(CURRENT_ACOUSTIC_FINGERPRINT_ALGORITHM_VERSION).toBe("er-dsp-2");
    expect(ER_DSP_2_FAILURE_MAP_REGIMES).toEqual([
      "close-overlapping-modes",
      "near-degenerate-modes",
      "short-decay",
      "broad-resonances",
      "coupled-modes",
      "low-snr",
    ]);
  });

  it("documents FFT/peak-tracking/decay-fitting failure regimes as research diagnostics, not release gates", () => {
    const close = caseFor("close-overlapping-modes", [
      { frequencyHz: 440, amplitude: 1, decaySeconds: 1.0 },
      { frequencyHz: 443, amplitude: 0.95, decaySeconds: 0.92 },
      { frequencyHz: 2413, amplitude: 0.4, decaySeconds: 0.4 },
    ]);
    const degenerate = caseFor("near-degenerate-modes", [
      { frequencyHz: 1000, amplitude: 1, decaySeconds: 0.9 },
      { frequencyHz: 1000.8, amplitude: 0.97, decaySeconds: 0.88 },
      { frequencyHz: 2413, amplitude: 0.35, decaySeconds: 0.4 },
    ]);
    const shortDecay = caseFor("short-decay", [
      { frequencyHz: 440, amplitude: 1, decaySeconds: 0.008 },
      { frequencyHz: 997, amplitude: 0.7, decaySeconds: 0.006 },
      { frequencyHz: 2413, amplitude: 0.45, decaySeconds: 0.005 },
    ]);
    const broad = caseFor("broad-resonances", [
      { frequencyHz: 140, amplitude: 1, decaySeconds: 0.035 },
      { frequencyHz: 280, amplitude: 0.7, decaySeconds: 0.03 },
      { frequencyHz: 420, amplitude: 0.45, decaySeconds: 0.028 },
    ]);
    const coupled = caseFor("coupled-modes", [
      { frequencyHz: 440, amplitude: 1, decaySeconds: 1.0 },
      { frequencyHz: 446, amplitude: 0.9, decaySeconds: 0.85 },
      { frequencyHz: 880, amplitude: 0.55, decaySeconds: 0.7 },
      { frequencyHz: 892, amplitude: 0.5, decaySeconds: 0.62 },
    ]);
    const lowSnr = caseFor("low-snr", [
      { frequencyHz: 440, amplitude: 0.08, decaySeconds: 1.0 },
      { frequencyHz: 997, amplitude: 0.05, decaySeconds: 0.7 },
      { frequencyHz: 2413, amplitude: 0.03, decaySeconds: 0.4 },
    ], { noiseAmplitude: 0.35, seed: 0x4552 });

    const report = compileErDsp2FailureMapReport([close, degenerate, shortDecay, broad, coupled, lowSnr]);
    expect(report.reportVersion).toBe("er-dsp-2-failure-map-1");
    expect(report.mappedAlgorithmVersion).toBe("er-dsp-2");
    expect(report.evidenceEligible).toBe(false);
    expect(report.releaseGateEquivalent).toBe(false);
    expect("algorithmVersion" in report).toBe(false);
    expect(report.cases.map((entry) => entry.regimeId).sort()).toEqual([...ER_DSP_2_FAILURE_MAP_REGIMES].sort());

    expect(close.analysisOk).toBe(false);
    expect(close.analysisFailureReason).toBe("NO_STABLE_RESONANCES");
    expect(close.recall).toBe(0);

    expect(degenerate.analysisOk).toBe(false);
    expect(degenerate.analysisFailureReason).toBe("NO_STABLE_RESONANCES");
    expect(degenerate.matchedModeCount).toBeLessThan(degenerate.trueModeCount);

    expect(coupled.matchedModeCount).toBeLessThan(coupled.trueModeCount);
    expect(coupled.recall).toBeLessThan(1);

    expect(lowSnr.recoveredModeCount).toBeGreaterThan(lowSnr.trueModeCount);
    expect(lowSnr.precision).not.toBeNull();
    expect(lowSnr.precision ?? 1).toBeLessThan(0.5);

    expect(shortDecay.regimeId).toBe("short-decay");
    expect(broad.regimeId).toBe("broad-resonances");
    expect(shortDecay.trueModeCount).toBe(3);
    expect(broad.trueModeCount).toBe(3);
  });

  it("is deterministic for a fixed synthetic seed", () => {
    const modes = [
      { frequencyHz: 440, amplitude: 0.2, decaySeconds: 0.8 },
      { frequencyHz: 997, amplitude: 0.15, decaySeconds: 0.5 },
      { frequencyHz: 2413, amplitude: 0.1, decaySeconds: 0.35 },
    ] as const;
    const first = caseFor("low-snr", modes, { noiseAmplitude: 0.12, seed: 99 });
    const second = caseFor("low-snr", modes, { noiseAmplitude: 0.12, seed: 99 });
    expect(second).toEqual(first);
  });
});

describe("research estimator hook", () => {
  it("dispatches the Prony research estimator without stamping a fingerprint algorithm version", () => {
    const sampleRate = 8_000;
    const samples = generateModalSignal({
      sampleRate,
      durationSeconds: 1.5,
      modes: [
        { frequencyHz: 440, amplitude: 0.8, decaySeconds: 1.0, phaseRadians: 0.2 },
        { frequencyHz: 448, amplitude: 0.55, decaySeconds: 0.72, phaseRadians: 1.1 },
      ],
    });
    const result = estimateDampedModesWithResearchEstimator(
      "prony-damped-modes-research-1",
      Array.from(samples),
      sampleRate,
      2,
    );
    expect(result.researchEstimatorVersion).toBe("prony-damped-modes-research-1");
    expect(result.evidenceEligible).toBe(false);
    expect(result).not.toHaveProperty("algorithmVersion");
    expect(result.modes).toHaveLength(2);
    expect(result.modes[0]!.frequencyHz).toBeCloseTo(440, 0);
    expect(result.modes[1]!.frequencyHz).toBeCloseTo(448, 0);
  });
});
