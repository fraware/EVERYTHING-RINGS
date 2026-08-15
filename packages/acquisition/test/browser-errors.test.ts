import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MicrophoneOpenError,
  classifyMicrophoneOpenFailure,
  openMicrophone,
} from "../src/browser";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe("openMicrophone", () => {
  it("requires a secure browser context", async () => {
    vi.stubGlobal("isSecureContext", false);

    await expect(openMicrophone()).rejects.toMatchObject({
      name: "MicrophoneOpenError",
      reason: "SECURE_CONTEXT_REQUIRED",
      message: "SECURE_CONTEXT_REQUIRED",
    });
  });

  it("rejects browsers without media capture support", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", {});

    await expect(openMicrophone()).rejects.toBeInstanceOf(MicrophoneOpenError);
    await expect(openMicrophone()).rejects.toMatchObject({ reason: "MICROPHONE_UNSUPPORTED" });
  });

  it("preserves classified permission failures", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue({ name: "NotAllowedError" }),
      },
    });

    await expect(openMicrophone()).rejects.toMatchObject({
      name: "MicrophoneOpenError",
      reason: "MICROPHONE_PERMISSION_DENIED",
    });
  });

  it("stops an unusable stream that contains no audio track", async () => {
    const stop = vi.fn();
    const stream = {
      getAudioTracks: () => [],
      getTracks: () => [{ stop }],
    };
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    });

    await expect(openMicrophone()).rejects.toMatchObject({ reason: "MICROPHONE_NOT_FOUND" });
    expect(stop).toHaveBeenCalledOnce();
  });

  it("retains actual capture settings on success", async () => {
    const track = {
      contentHint: "",
      getSettings: () => ({
        sampleRate: 44_100,
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        deviceId: "microphone-01",
      }),
    };
    const stream = {
      getAudioTracks: () => [track],
      getTracks: () => [track],
    };
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    });

    const opened = await openMicrophone();

    expect(opened.stream).toBe(stream);
    expect(opened.track).toBe(track);
    expect(track.contentHint).toBe("music");
    expect(opened.settings).toEqual({
      sampleRate: 44_100,
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      deviceId: "microphone-01",
    });
  });
});
