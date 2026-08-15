export {
  type AnalysisConfig,
  type AnalysisFailureReason,
  type AnalysisResult,
  DEFAULT_ANALYSIS_CONFIG_V1,
  analyzeImpact,
} from "./analysis/analyze-impact";
export {
  DEFAULT_DECAY_FIT_CONFIG,
  type DecayEstimate,
  type DecayFitConfig,
  type DecayFitFailureReason,
  type DecayFitResult,
  estimateTrackDecay,
} from "./decay/estimate";
export {
  DEFAULT_ROBUST_LINE_CONFIG,
  fitRobustLine,
  type RobustLineConfig,
  type RobustLineFit,
} from "./decay/robust-line";
export type { FFTBackend } from "./fft/backend";
export { FFTJsBackend } from "./fft/fft-js-backend";
export {
  DEFAULT_MODE_CONFIDENCE_CONFIG,
  type ModeConfidenceConfig,
  modeConfidence,
} from "./modes/confidence";
export {
  DEFAULT_MODE_SELECTION_CONFIG,
  type ModeSelectionConfig,
  selectAcousticModes,
} from "./modes/select";
export type {
  AcousticFingerprintV1,
  AcousticMode,
  AcousticModeDiagnostics,
} from "./modes/types";
export {
  DEFAULT_PEAK_DETECTION_CONFIG,
  detectSpectralPeaks,
  type PeakDetectionConfig,
  type SpectralPeak,
} from "./peaks/detect";
export { findMaximumBin } from "./peaks/maximum";
export { type InterpolatedPeak, interpolateQuadraticPeakDb } from "./peaks/quadratic";
export {
  computeWindowedMagnitudeSpectrumDb,
  createMagnitudeSpectrumWorkspace,
  type MagnitudeSpectrumWorkspace,
} from "./spectrum/magnitude";
export { DEFAULT_STFT_CONFIG, type STFTConfig, validateSTFTConfig } from "./stft/config";
export {
  forEachSpectrumFrame,
  type SpectrumFrameConsumer,
  type SpectrumFrameView,
} from "./stft/frames";
export {
  DEFAULT_TRACK_ACCEPTANCE_CONFIG,
  isStablePeakTrack,
  type PeakTrackSummary,
  summarizePeakTrack,
  type TrackAcceptanceConfig,
} from "./tracking/stability";
export {
  DEFAULT_PEAK_TRACKING_CONFIG,
  type PeakTrack,
  type PeakTrackObservation,
  type PeakTrackingConfig,
  type SpectralPeakFrame,
  trackSpectralPeaks,
} from "./tracking/tracks";
export { hannWindow } from "./windows/hann";
