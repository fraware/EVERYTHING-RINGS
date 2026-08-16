import { describe, expect, it, vi } from "vitest";
import { ensureAudioContextRunning, type ResumableAudioContext } from "./audioContext";

function context(state: AudioContextState, resume: () => Promise<void>): ResumableAudioContext {
  return { get state() { return state; }, resume };
}

describe("ensureAudioContextRunning", () => {
  it("returns immediately for a running context", async () => {
    const resume = vi.fn(async () => {});
    expect(await ensureAudioContextRunning(context("running", resume))).toBe(true);
    expect(resume).not.toHaveBeenCalled();
  });

  it("fails closed for a closed context", async () => {
    const resume = vi.fn(async () => {});
    expect(await ensureAudioContextRunning(context("closed", resume))).toBe(false);
    expect(resume).not.toHaveBeenCalled();
  });

  it("resumes a suspended context", async () => {
    let state: AudioContextState = "suspended";
    const target: ResumableAudioContext = {
      get state() { return state; },
      async resume() { state = "running"; },
    };
    expect(await ensureAudioContextRunning(target)).toBe(true);
  });

  it("fails when resume is rejected", async () => {
    const target: ResumableAudioContext = {
      state: "suspended",
      async resume() { throw new Error("gesture required"); },
    };
    expect(await ensureAudioContextRunning(target)).toBe(false);
  });

  it("fails when resume resolves without reaching running", async () => {
    const target: ResumableAudioContext = {
      state: "suspended",
      async resume() {},
    };
    expect(await ensureAudioContextRunning(target)).toBe(false);
  });
});
