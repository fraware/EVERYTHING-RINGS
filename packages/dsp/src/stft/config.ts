export interface STFTConfig {
  readonly fftSize: number;
  readonly hopSize: number;
}

export const DEFAULT_STFT_CONFIG: STFTConfig = {
  fftSize: 8192,
  hopSize: 512,
};

export function validateSTFTConfig(config: STFTConfig): void {
  if (!Number.isInteger(config.fftSize) || config.fftSize < 2 || (config.fftSize & (config.fftSize - 1)) !== 0) {
    throw new RangeError(`STFT fftSize must be a power of two >= 2; received ${config.fftSize}`);
  }
  if (!Number.isInteger(config.hopSize) || config.hopSize < 1 || config.hopSize > config.fftSize) {
    throw new RangeError(`STFT hopSize must be an integer in [1, fftSize]; received ${config.hopSize}`);
  }
}
