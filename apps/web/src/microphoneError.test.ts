import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeMicrophoneStartupFailure } from "./microphoneError";

describe("normalizeMicrophoneStartupFailure", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { isSecureContext: true });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });
    vi.stubGlobal("AudioContext", class {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
  });

  it("detects missing mediaDevices", () => {
    vi.stubGlobal("navigator", {});
    expect(normalizeMicrophoneStartupFailure(new Error("missing"))).toBe("MIC_UNSUPPORTED");
  });

  it("detects missing getUserMedia", () => {
    vi.stubGlobal("navigator", { mediaDevices: {} });
    expect(normalizeMicrophoneStartupFailure(new Error("missing"))).toBe("MIC_UNSUPPORTED");
  });

  it("detects missing AudioContext", () => {
    vi.stubGlobal("AudioContext", undefined);
    expect(normalizeMicrophoneStartupFailure(new Error("missing"))).toBe("MIC_UNSUPPORTED");
  });
});
