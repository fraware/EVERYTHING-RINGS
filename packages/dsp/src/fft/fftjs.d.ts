declare module "fft.js" {
  export default class FFT {
    constructor(size: number);
    createComplexArray(): number[];
    realTransform(output: number[], input: ArrayLike<number>): void;
  }
}
