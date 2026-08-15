export interface FFTBackend {
  readonly size: number;
  readonly binCount: number;

  forwardReal(
    input: Float32Array,
    outputReal: Float64Array,
    outputImag: Float64Array,
  ): void;
}

export function assertPowerOfTwo(value: number): void {
  if (!Number.isInteger(value) || value < 2 || (value & (value - 1)) !== 0) {
    throw new RangeError(`FFT size must be a power of two >= 2; received ${value}`);
  }
}
