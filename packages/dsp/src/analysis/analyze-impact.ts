import { DEFAULT_DECAY_FIT_CONFIG, estimateTrackDecay, type DecayFitConfig } from "../decay/estimate";
import { FFTJsBackend } from "../fft/fft-js-backend";
import {
  DEFAULT_MODE_CONFIDENCE_CONFIG,
  modeConfidence,
  type ModeConfidenceConfig,
} from "../modes/confidence";
import {
  DEFAULT_MODE_SELECTION_CONFIG,
  selectAcousticModes,
  type ModeSelectionConfig,
} from "../modes/select";
import type { AcousticFingerprintV1, AcousticMode } from "../modes/types";
import {
  DEFAULT_PEAK_DETECTION_CONFIG,
  detectSpectralPeaks,
  type PeakDetectionConfig,
} from "../peaks/detect";
import { DEFAULT_STFT_CONFIG, type STFTConfig } from "../stft/config";
import { forEachSpectrumFrame } from "../stft/frames";
import {
  DEFAULT_TRACK_ACCEPTANCE_CONFIG,
  isStablePeakTrack,
  summarizePeakTrack,
  type TrackAcceptanceConfig,
} from "../tracking/stability";
import {
  DEFAULT_PEAK_TRACKING_CONFIG,
  trackSpectralPeaks,
  type PeakTrackingConfig,
  type SpectralPeakFrame,
} from "../tracking/tracks";

export interface AnalysisConfig {
  readonly stft: STFTConfig;
  readonly peaks: PeakDetectionConfig;
  readonly tracking: PeakTrackingConfig;
  readonly trackAcceptance: TrackAcceptanceConfig;
  readonly decay: DecayFitConfig;
  readonly confidence: ModeConfidenceConfig;
  readonly selection: ModeSelectionConfig;
  readonly minimumModes: number;
}

export const DEFAULT_ANALYSIS_CONFIG_V1: AnalysisConfig = {
  stft: DEFAULT_STFT_CONFIG,
  peaks: DEFAULT_PEAK_DETECTION_CONFIG,
  tracking: DEFAULT_PEAK_TRACKING_CONFIG,
  trackAcceptance: DEFAULT_TRACK_ACCEPTANCE_CONFIG,
  decay: DEFAULT_DECAY_FIT_CONFIG,
  confidence: DEFAULT_MODE_CONFIDENCE_CONFIG,
  selection: DEFAULT_MODE_SELECTION_CONFIG,
  minimumModes: 3,
};

export type AnalysisFailureReason = "SIGNAL_TOO_SHORT" | "NO_STABLE_RESONANCES";

export type AnalysisResult =
  | { readonly ok: true; readonly fingerprint: AcousticFingerprintV1 }
  | { readonly ok: false; readonly reason: AnalysisFailureReason };

function maximumTrackMagnitudeDb(observations: readonly { magnitudeDb: number }[]): number {
  return Math.max(...observations.map((observation) => observation.magnitudeDb));
}

export function analyzeImpact(
  samples: Float32Array,
  sampleRate: number,
  config: AnalysisConfig = DEFAULT_ANALYSIS_CONFIG_V1,
): AnalysisResult {
  if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) {
    throw new RangeError(`Sample rate must be finite and positive; received ${sampleRate}`);
  }
  if (samples.length < config.stft.fftSize) {
    return { ok: false, reason: "SIGNAL_TOO_SHORT" };
  }

  const fft = new FFTJsBackend(config.stft.fftSize);
  const peakFrames: SpectralPeakFrame[] = [];
  forEachSpectrumFrame(samples, sampleRate, fft, config.stft, (frame) => {
    peakFrames.push({
      frameIndex: frame.frameIndex,
      timeSeconds: frame.centerTimeSeconds,
      peaks: detectSpectralPeaks(
        frame.magnitudeDb,
        sampleRate,
        config.stft.fftSize,
        config.peaks,
      ),
    });
  });

  const tracks = trackSpectralPeaks(peakFrames, config.tracking);
  const provisional: Array<{
    mode: Omit<AcousticMode, "relativeAmplitude" | "confidence">;
    maximumMagnitudeDb: number;
  }> = [];

  for (const track of tracks) {
    const summary = summarizePeakTrack(track);
    if (!isStablePeakTrack(summary, config.trackAcceptance)) continue;
    const decay = estimateTrackDecay(track, summary, config.decay);
    if (!decay.ok) continue;

    provisional.push({
      maximumMagnitudeDb: maximumTrackMagnitudeDb(track.observations),
      mode: {
        frequencyHz: summary.frequencyHz,
        decaySeconds: decay.estimate.decaySeconds,
        q: decay.estimate.q,
        diagnostics: {
          prominenceDb: summary.maximumProminenceDb,
          persistenceSeconds: summary.durationSeconds,
          frequencyStdCents: summary.frequencyStdCents,
          decayFitScore: decay.estimate.fitScore,
          observationCount: summary.observationCount,
        },
      },
    });
  }

  if (provisional.length === 0) {
    return { ok: false, reason: "NO_STABLE_RESONANCES" };
  }

  const maximumMagnitudeDb = Math.max(...provisional.map((candidate) => candidate.maximumMagnitudeDb));
  const candidates: AcousticMode[] = provisional.map((candidate) => {
    const relativeAmplitude = 10 ** ((candidate.maximumMagnitudeDb - maximumMagnitudeDb) / 20);
    const confidence = modeConfidence(candidate.mode.diagnostics, config.confidence);
    return { ...candidate.mode, relativeAmplitude, confidence };
  });
  const modes = selectAcousticModes(candidates, config.selection);

  if (modes.length < config.minimumModes) {
    return { ok: false, reason: "NO_STABLE_RESONANCES" };
  }

  return {
    ok: true,
    fingerprint: {
      version: 1,
      algorithmVersion: "er-dsp-1",
      sampleRate,
      durationSeconds: samples.length / sampleRate,
      modes,
    },
  };
}
