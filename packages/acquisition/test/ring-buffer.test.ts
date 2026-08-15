import { describe, expect, it } from "vitest";
import { Float32RingBuffer } from "../src/ring-buffer";

describe("Float32RingBuffer", () => {
  it("returns the newest samples in chronological order across wraparound", () => {
    const ring = new Float32RingBuffer(4);
    ring.write(Float32Array.from([1, 2, 3]));
    ring.write(Float32Array.from([4, 5]));
    expect(Array.from(ring.copyLast(4))).toEqual([2, 3, 4, 5]);
    expect(Array.from(ring.copyLast(2))).toEqual([4, 5]);
  });
});
