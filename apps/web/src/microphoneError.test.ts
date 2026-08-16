import { describe, expect, it, vi } from "vitest";
import { normalizeMicrophoneStartupFailure } from "./microphoneError";

describe("normalizeMicrophoneStartupFailure", () => {
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
  ] as const)("maps %s", (name, expected) => {
    expect(normalizeMicrophoneStartupFailure({ name })).toBe(expected);
  });

  it("prefers insecure-context detection", () => {
    vi.stubGlobal("window", { isSecureContext: false });
    expect(normalizeMicrophoneStartupFailure({ name: "NotAllowedError" })).toBe("MIC_INSECURE_CONTEXT");
    vi.unstubAllGlobals();
  });

  it("detects missing mediaDevices", () => {
    vi.stubGlobal("window", { isSecureContext: true });
    vi.stubGlobal("navigator", {});
    expect(normalizeMicrophoneStartupFailure(new Error("missing"))).toBe("MIC_UNSUPPORTED");
    vi.unstubAllGlobals();
  });
});
