export class Float32RingBuffer {
  private readonly data: Float32Array;
  private writeIndex = 0;
  private length = 0;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError(`Ring-buffer capacity must be a positive integer; received ${capacity}`);
    }
    this.data = new Float32Array(capacity);
  }

  get availableSamples(): number {
    return this.length;
  }

  clear(): void {
    this.writeIndex = 0;
    this.length = 0;
  }

  write(samples: Float32Array): void {
    for (let index = 0; index < samples.length; index += 1) {
      this.data[this.writeIndex] = samples[index] ?? 0;
      this.writeIndex = (this.writeIndex + 1) % this.capacity;
      this.length = Math.min(this.capacity, this.length + 1);
    }
  }

  copyLast(sampleCount: number): Float32Array {
    if (!Number.isInteger(sampleCount) || sampleCount < 0) {
      throw new RangeError(`Sample count must be a non-negative integer; received ${sampleCount}`);
    }
    const count = Math.min(sampleCount, this.length);
    const output = new Float32Array(count);
    const start = (this.writeIndex - count + this.capacity) % this.capacity;
    for (let index = 0; index < count; index += 1) {
      output[index] = this.data[(start + index) % this.capacity] ?? 0;
    }
    return output;
  }
}
