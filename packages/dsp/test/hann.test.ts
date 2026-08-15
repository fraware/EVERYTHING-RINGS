import { describe, expect, it } from "vitest";

import { hannWindow } from "../src/windows/hann";

describe("hannWindow", () => {
  it("has zero endpoints and mirror symmetry", () => {
    const window = hannWindow(32);
    expect(window[0]).toBeCloseTo(0, 7);
    expect(window[31]).toBeCloseTo(0, 7);
    for (let index = 0; index < window.length; index += 1) {
      expect(window[index]).toBeCloseTo(window[window.length - 1 - index] ?? 0, 7);
    }
  });
});
