import { describe, it } from "vitest";
import { Float32RingBuffer } from "../src";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

describe("acquisition stress invariants", () => {
  it("matches a reference queue across 1000 seeded ring-buffer state machines", () => {
    for (let seed = 1; seed <= 1000; seed += 1) {
      const random = rng(seed);
      const capacity = 1 + Math.floor(random() * 128);
      const ring = new Float32RingBuffer(capacity);
      let expected: number[] = [];
      const operations = 5 + Math.floor(random() * 30);
      for (let operation = 0; operation < operations; operation += 1) {
        if (random() < 0.08) {
          ring.clear();
          expected = [];
        } else {
          const length = Math.floor(random() * 80);
          const chunk = new Float32Array(length);
          for (let index = 0; index < length; index += 1) chunk[index] = random() * 2 - 1;
          ring.write(chunk);
          expected.push(...Array.from(chunk));
          if (expected.length > capacity) expected = expected.slice(expected.length - capacity);
        }
        if (ring.availableSamples !== expected.length) throw new Error(`seed ${seed}, operation ${operation}: availableSamples mismatch`);
        const request = Math.floor(random() * (capacity + 40));
        const count = Math.min(request, expected.length);
        const wanted = expected.slice(expected.length - count);
        const actual = Array.from(ring.copyLast(request));
        if (actual.length !== wanted.length || actual.some((value, index) => value !== wanted[index])) throw new Error(`seed ${seed}, operation ${operation}: ring-buffer content diverged`);
      }
    }
  });
});
