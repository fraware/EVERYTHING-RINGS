import { describe, expect, it } from "vitest";
import { Float32RingBuffer, measureBlock } from "../src";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("1,000-case acquisition stress", () => {
  it("matches a reference FIFO model under randomized writes and reads", () => {
    for (let seed = 0; seed < 1000; seed += 1) {
      const random = rng(seed ^ 0xa51c);
      const capacity = 1 + Math.floor(random() * 257);
      const ring = new Float32RingBuffer(capacity);
      const model: number[] = [];
      const operations = 4 + Math.floor(random() * 20);
      for (let operation = 0; operation < operations; operation += 1) {
        const length = Math.floor(random() * (capacity * 2 + 1));
        const chunk = new Float32Array(length);
        for (let index = 0; index < length; index += 1) chunk[index] = random() * 2 - 1;
        ring.write(chunk);
        model.push(...Array.from(chunk));
        if (model.length > capacity) model.splice(0, model.length - capacity);
        const requested = Math.floor(random() * (capacity * 2 + 1));
        const count = Math.min(requested, model.length);
        const expected = count === 0 ? [] : model.slice(-count);
        expect(Array.from(ring.copyLast(requested))).toEqual(expected);
        expect(ring.availableSamples).toBe(model.length);
      }
      ring.clear();
      expect(ring.availableSamples).toBe(0);
      expect(ring.copyLast(capacity)).toHaveLength(0);
    }
  });

  it("matches reference RMS, peak, and peak index for randomized blocks", () => {
    for (let seed = 0; seed < 1000; seed += 1) {
      const random = rng(seed ^ 0x7e57);
      const length = Math.floor(random() * 513);
      const block = new Float32Array(length);
      for (let index = 0; index < length; index += 1) block[index] = random() * 2 - 1;
      const measured = measureBlock(block);
      if (length === 0) {
        expect(measured).toEqual({ rms: 0, peak: 0, peakIndex: 0 });
        continue;
      }
      let sumSquares = 0;
      let peak = 0;
      let peakIndex = 0;
      for (let index = 0; index < block.length; index += 1) {
        const value = block[index] ?? 0;
        sumSquares += value * value;
        if (Math.abs(value) > peak) {
          peak = Math.abs(value);
          peakIndex = index;
        }
      }
      expect(measured.rms).toBeCloseTo(Math.sqrt(sumSquares / length), 12);
      expect(measured.peak).toBe(peak);
      expect(measured.peakIndex).toBe(peakIndex);
    }
  });
});
