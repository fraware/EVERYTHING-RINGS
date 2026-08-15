export type { FFTBackend } from "./fft/backend";
export { FFTJsBackend } from "./fft/fft-js-backend";
export { findMaximumBin } from "./peaks/maximum";
export { type InterpolatedPeak, interpolateQuadraticPeakDb } from "./peaks/quadratic";
export {
  computeWindowedMagnitudeSpectrumDb,
  createMagnitudeSpectrumWorkspace,
  type MagnitudeSpectrumWorkspace,
} from "./spectrum/magnitude";
export { hannWindow } from "./windows/hann";
