import { describe, expect, it } from "vitest";
import { ensureAudioContextRunning, normalizeMediaRuntimeFailure } from "./mediaRuntime";

describe("normalizeMediaRuntimeFailure", () => {
  it.each([
    ["NotAllowedError", "MICROPHONE_PERMISSION_DENIED"],
    ["SecurityError", "MICROPHONE_PERMISSION_DENIED"],
    ["NotFoundError", "MICROPHONE_NOT_FOUND"],
    ["NotReadableError", "MICROPHONE_UNAVAILABLE"],
    ["AbortError", "MICROPHONE_ABORTED"],
    ["OverconstrainedError", "MICROPHONE_CONSTRAINTS"],
  ])("maps %s to a stable reason", (name, expected) => {
    expect(normalizeMediaRuntimeFailure({ name, message: "browser-specific text" })).toBe(expected);
  });

  it("preserves the explicit unsupported marker", () => {
    expect(normalizeMediaRuntimeFailure(new Error("MICROPHONE_UNSUPPORTED"))).toBe("MICROPHONE_UNSUPPORTED");
  });

  it("retains unknown diagnostic messages", () => {
    expect(normalizeMediaRuntimeFailure(new Error("unexpected audio failure"))).toBe("unexpected audio failure");
  });

  it("fails to a stable generic marker for non-errors", () => {
    expect(normalizeMediaRuntimeFailure(null)).toBe("MEDIA_SESSION_ERROR");
  });
});

describe("ensureAudioContextRunning", () => {
  it("does not resume an already-running context", async () => {
    let resumeCalls = 0;
    const context = {
      state: "running",
      async resume() { resumeCalls += 1; },
    };
    await expect(ensureAudioContextRunning(context)).resolves.toBe(true);
    expect(resumeCalls).toBe(0);
  });

  it("resumes a suspended context", async () => {
    let state = "suspended";
    const context = {
      get state() { return state; },
      async resume() { state = "running"; },
    };
    await expect(ensureAudioContextRunning(context)).resolves.toBe(true);
  });

  it("fails closed for a closed context", async () => {
    const context = {
      state: "closed",
      async resume() { throw new Error("must not run"); },
    };
    await expect(ensureAudioContextRunning(context)).resolves.toBe(false);
  });

  it("fails closed when resume is rejected", async () => {
    const context = {
      state: "suspended",
      async resume() { throw new Error("gesture required"); },
    };
    await expect(ensureAudioContextRunning(context)).resolves.toBe(false);
  });
});
