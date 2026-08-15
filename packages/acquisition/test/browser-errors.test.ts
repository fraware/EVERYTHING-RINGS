import { describe, expect, it } from "vitest";
import { classifyMicrophoneOpenFailure } from "../src/browser";

const cases = [
  ["NotAllowedError", "MICROPHONE_PERMISSION_DENIED"],
  ["PermissionDeniedError", "MICROPHONE_PERMISSION_DENIED"],
  ["SecurityError", "MICROPHONE_PERMISSION_DENIED"],
  ["NotFoundError", "MICROPHONE_NOT_FOUND"],
  ["DevicesNotFoundError", "MICROPHONE_NOT_FOUND"],
  ["NotReadableError", "MICROPHONE_UNAVAILABLE"],
  ["TrackStartError", "MICROPHONE_UNAVAILABLE"],
  ["AbortError", "MICROPHONE_UNAVAILABLE"],
  ["OverconstrainedError", "MICROPHONE_CONSTRAINTS_UNSATISFIED"],
  ["ConstraintNotSatisfiedError", "MICROPHONE_CONSTRAINTS_UNSATISFIED"],
] as const;

describe("classifyMicrophoneOpenFailure", () => {
  for (const [name, expected] of cases) {
    it(`maps ${name} to ${expected}`, () => {
      expect(classifyMicrophoneOpenFailure({ name })).toBe(expected);
    });
  }

  it("fails closed for an unknown named error", () => {
    expect(classifyMicrophoneOpenFailure({ name: "UnknownError" })).toBe("MICROPHONE_OPEN_FAILED");
  });

  it("fails closed for non-error values", () => {
    expect(classifyMicrophoneOpenFailure(undefined)).toBe("MICROPHONE_OPEN_FAILED");
    expect(classifyMicrophoneOpenFailure("denied")).toBe("MICROPHONE_OPEN_FAILED");
  });
});
