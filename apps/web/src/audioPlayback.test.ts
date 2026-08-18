import { describe, expect, it, vi } from "vitest";
import { SamplePlaybackController } from "./audioPlayback";

interface FakeSource {
  buffer: AudioBuffer | null;
  onended: (() => void) | null;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

function fakeContext(initialState: AudioContextState = "running") {
  const sources: FakeSource[] = [];
  const context = {
    state: initialState,
    destination: {},
    resume: vi.fn(async () => { context.state = "running"; }),
    createBuffer: vi.fn(() => ({ copyToChannel: vi.fn() })),
    createBufferSource: vi.fn(() => {
      const source: FakeSource = {
        buffer: null,
        onended: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      sources.push(source);
      return source;
    }),
  };
  return { context: context as unknown as AudioContext, raw: context, sources };
}

describe("SamplePlaybackController", () => {
  it("resumes an inactive audio context before playback", async () => {
    const { context, raw, sources } = fakeContext("suspended");
    const playback = new SamplePlaybackController(context);
    await playback.play(Float32Array.from([0, 0.25, -0.25]), 48_000);
    expect(raw.resume).toHaveBeenCalledOnce();
    expect(sources[0]?.start).toHaveBeenCalledOnce();
  });

  it("keeps at most one sample source active", async () => {
    const { context, sources } = fakeContext();
    const playback = new SamplePlaybackController(context);
    await playback.play(Float32Array.from([0, 0.2]), 48_000);
    await playback.play(Float32Array.from([0, 0.3]), 48_000);
    expect(sources).toHaveLength(2);
    expect(sources[0]?.stop).toHaveBeenCalledOnce();
    expect(sources[0]?.disconnect).toHaveBeenCalledOnce();
    expect(sources[1]?.start).toHaveBeenCalledOnce();
  });

  it("stops and disconnects the active source idempotently", async () => {
    const { context, sources } = fakeContext();
    const playback = new SamplePlaybackController(context);
    await playback.play(Float32Array.from([0, 0.2]), 44_100);
    playback.stop();
    playback.stop();
    expect(sources[0]?.stop).toHaveBeenCalledOnce();
    expect(sources[0]?.disconnect).toHaveBeenCalledOnce();
  });

  it("surfaces resume failure without scheduling audio", async () => {
    const { context, raw, sources } = fakeContext("suspended");
    raw.resume.mockRejectedValueOnce(new Error("resume blocked"));
    const playback = new SamplePlaybackController(context);
    await expect(playback.play(Float32Array.from([0, 0.2]), 48_000)).rejects.toThrow("resume blocked");
    expect(sources).toHaveLength(0);
  });

  it("rejects invalid audio inputs", async () => {
    const { context } = fakeContext();
    const playback = new SamplePlaybackController(context);
    await expect(playback.play(new Float32Array(0), 48_000)).rejects.toThrow(RangeError);
    await expect(playback.play(Float32Array.from([0]), 0)).rejects.toThrow(RangeError);
  });
});
