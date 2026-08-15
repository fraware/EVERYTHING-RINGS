export type { FFTBackend } from "./fft/backend";
export { FFTJsBackend } from "./fft/fft-js-backend";
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
export {
  DEFAULT_STFT_CONFIG,
  type STFTConfig,
  validateSTFTConfig,
} from "./stft/config";
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
