import { describe, expect, it, vi } from "vitest";
import {
  playExclusiveSamples,
  resumeAudioContext,
  stopActivePlayback,
  type ActivePlayback,
} from "./audioRuntime";

function sourceDouble() {
  return {
    buffer: null,
    onended: null as (() => void) | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

function contextDouble(initialState: AudioContextState, source = sourceDouble()) {
  let state = initialState;
  const copyToChannel = vi.fn();
  const context = {
    get state() { return state; },
    resume: vi.fn(async () => { state = "running"; }),
    createBuffer: vi.fn(() => ({ copyToChannel })),
    createBufferSource: vi.fn(() => source),
    destination: {},
  };
  return {
    context: context as unknown as AudioContext,
    source,
    copyToChannel,
    setState(next: AudioContextState) { state = next; },
  };
}

describe("resumeAudioContext", () => {
  it("does not resume an already running context", async () => {
    const { context } = contextDouble("running");
    await expect(resumeAudioContext(context)).resolves.toBe(true);
    expect(context.resume).not.toHaveBeenCalled();
  });

  it("resumes a suspended context", async () => {
    const { context } = contextDouble("suspended");
    await expect(resumeAudioContext(context)).resolves.toBe(true);
    expect(context.resume).toHaveBeenCalledOnce();
  });

  it("fails closed for a closed context", async () => {
    const { context } = contextDouble("closed");
    await expect(resumeAudioContext(context)).resolves.toBe(false);
    expect(context.resume).not.toHaveBeenCalled();
  });

  it("fails closed when resume rejects", async () => {
    const { context } = contextDouble("suspended");
    vi.mocked(context.resume).mockRejectedValueOnce(new Error("resume failed"));
    await expect(resumeAudioContext(context)).resolves.toBe(false);
  });
});

describe("exclusive sample playback", () => {
  it("stops and disconnects the previous source before replacing it", async () => {
    const previous = sourceDouble();
    const replacement = sourceDouble();
    const { context, copyToChannel } = contextDouble("suspended", replacement);
    const playback: ActivePlayback = { current: previous as unknown as AudioBufferSourceNode };
    const samples = new Float32Array([0.25, -0.5, 0.75]);

    await expect(playExclusiveSamples(context, playback, samples, 48_000)).resolves.toBe(true);

    expect(context.resume).toHaveBeenCalledOnce();
    expect(previous.stop).toHaveBeenCalledOnce();
    expect(previous.disconnect).toHaveBeenCalledOnce();
    expect(copyToChannel).toHaveBeenCalledOnce();
    expect(replacement.start).toHaveBeenCalledOnce();
    expect(playback.current).toBe(replacement);
  });

  it("clears the slot when the active source ends", async () => {
    const replacement = sourceDouble();
    const { context } = contextDouble("running", replacement);
    const playback: ActivePlayback = { current: undefined };

    await playExclusiveSamples(context, playback, new Float32Array([0.1]), 44_100);
    replacement.onended?.();

    expect(playback.current).toBeUndefined();
    expect(replacement.disconnect).toHaveBeenCalledOnce();
  });

  it("does not replace playback when output cannot resume", async () => {
    const previous = sourceDouble();
    const { context } = contextDouble("closed");
    const playback: ActivePlayback = { current: previous as unknown as AudioBufferSourceNode };

    await expect(playExclusiveSamples(context, playback, new Float32Array([0.1]), 44_100)).resolves.toBe(false);

    expect(playback.current).toBe(previous);
    expect(previous.stop).not.toHaveBeenCalled();
  });
});

describe("stopActivePlayback", () => {
  it("is idempotent", () => {
    const source = sourceDouble();
    const playback: ActivePlayback = { current: source as unknown as AudioBufferSourceNode };

    stopActivePlayback(playback);
    stopActivePlayback(playback);

    expect(source.stop).toHaveBeenCalledOnce();
    expect(source.disconnect).toHaveBeenCalledOnce();
    expect(playback.current).toBeUndefined();
  });
});
