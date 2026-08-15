import FFT from "fft.js";

import { assertPowerOfTwo, type FFTBackend } from "./backend";

export class FFTJsBackend implements FFTBackend {
  readonly size: number;
  readonly binCount: number;

  readonly #fft: FFT;
  readonly #complex: number[];

  constructor(size: number) {
    assertPowerOfTwo(size);
    this.size = size;
    this.binCount = size / 2 + 1;
    this.#fft = new FFT(size);
    this.#complex = this.#fft.createComplexArray();
  }

  forwardReal(
    input: Float32Array,
    outputReal: Float64Array,
    outputImag: Float64Array,
  ): void {
    if (input.length !== this.size) {
      throw new RangeError(`Expected ${this.size} input samples; received ${input.length}`);
    }
    if (outputReal.length < this.binCount || outputImag.length < this.binCount) {
      throw new RangeError(`FFT outputs must contain at least ${this.binCount} bins`);
    }

    this.#fft.realTransform(this.#complex, input);
    for (let binIndex = 0; binIndex < this.binCount; binIndex += 1) {
      outputReal[binIndex] = this.#complex[2 * binIndex] ?? 0;
      outputImag[binIndex] = this.#complex[2 * binIndex + 1] ?? 0;
    }
  }
}
