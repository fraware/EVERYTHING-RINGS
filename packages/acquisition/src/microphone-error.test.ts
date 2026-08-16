import { describe, expect, it } from "vitest";
import { MicrophoneStartupError, normalizeMicrophoneStartupFailure } from "./microphone-error";

describe("microphone startup errors", () => {
  it.each([
    ["NotAllowedError", "MIC_PERMISSION_DENIED"],
    ["PermissionDeniedError", "MIC_PERMISSION_DENIED"],
    ["NotFoundError", "MIC_NOT_FOUND"],
    ["DevicesNotFoundError", "MIC_NOT_FOUND"],
    ["NotReadableError", "MIC_BUSY"],
    ["TrackStartError", "MIC_BUSY"],
    ["SecurityError", "MIC_INSECURE_CONTEXT"],
    ["NotSupportedError", "MIC_UNSUPPORTED"],
    ["OtherError", "MIC_START_FAILED"],
  ] as const)("maps %s to %s", (name, expected) => {
    expect(normalizeMicrophoneStartupFailure({ name })).toBe(expected);
  });

  it("carries the stable code as the Error message", () => {
    const error = new MicrophoneStartupError("MIC_PERMISSION_DENIED");
    expect(error.message).toBe("MIC_PERMISSION_DENIED");
    expect(error.code).toBe("MIC_PERMISSION_DENIED");
  });
});
