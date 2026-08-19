import type { CaptureGraph, OpenedMicrophone } from "@everything-rings/acquisition";
import { describe, expect, it, vi } from "vitest";
import {
  OpeningSessionResources,
  SessionLifecycleGeneration,
  ownsSessionResources,
} from "./sessionLifecycle";

function fakeMicrophone() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: vi.fn(() => [track]) };
  const microphone = {
    stream,
    track: {},
    settings: {},
  } as unknown as OpenedMicrophone;
  return { microphone, track, stream };
}

function fakeContext() {
  return {
    close: vi.fn(async (): Promise<void> => undefined),
  } as unknown as AudioContext;
}

function fakeGraph() {
  const graph = {
    node: { port: { onmessage: vi.fn() } },
    disconnect: vi.fn(),
  } as unknown as CaptureGraph;
  return graph;
}

function fakeWorker() {
  return {
    onmessage: vi.fn(),
    onerror: vi.fn(),
    terminate: vi.fn(),
  } as unknown as Worker;
}

describe("SessionLifecycleGeneration", () => {
  it("invalidates a cancelled generation and gives the next start a distinct owner", () => {
    const lifecycle = new SessionLifecycleGeneration();
    const first = lifecycle.begin();

    expect(lifecycle.owns(first)).toBe(true);
    lifecycle.invalidate();
    expect(lifecycle.owns(first)).toBe(false);

    const second = lifecycle.begin();
    expect(second).not.toBe(first);
    expect(lifecycle.owns(second)).toBe(true);
    expect(lifecycle.owns(first)).toBe(false);
  });

  it("requires both generation and exact resource identity for callback ownership", () => {
    const lifecycle = new SessionLifecycleGeneration();
    const first = lifecycle.begin();
    const firstResources = {};
    const secondResources = {};

    expect(ownsSessionResources(lifecycle, first, firstResources, firstResources)).toBe(true);
    expect(ownsSessionResources(lifecycle, first, secondResources, firstResources)).toBe(false);

    lifecycle.invalidate();
    expect(ownsSessionResources(lifecycle, first, firstResources, firstResources)).toBe(false);

    const second = lifecycle.begin();
    expect(ownsSessionResources(lifecycle, second, secondResources, secondResources)).toBe(true);
    expect(ownsSessionResources(lifecycle, second, firstResources, secondResources)).toBe(false);
  });

  it("makes queued callbacks from a disposed generation inert", () => {
    const lifecycle = new SessionLifecycleGeneration();
    const generation = lifecycle.begin();
    const resources = {};
    let current: typeof resources | undefined = resources;
    const effects: string[] = [];
    const callback = (): void => {
      if (!ownsSessionResources(lifecycle, generation, current, resources)) return;
      effects.push("state-change");
    };

    lifecycle.invalidate();
    current = undefined;
    callback();

    expect(effects).toEqual([]);
  });
});

describe("OpeningSessionResources", () => {
  it("stops a microphone that resolves after startup cancellation", () => {
    const opening = new OpeningSessionResources();
    const fake = fakeMicrophone();

    opening.dispose();

    expect(opening.attachMicrophone(fake.microphone)).toBe(false);
    expect(fake.track.stop).toHaveBeenCalledOnce();
  });

  it("immediately cleans partial microphone/context ownership on cancellation", () => {
    const opening = new OpeningSessionResources();
    const fake = fakeMicrophone();
    const context = fakeContext();

    expect(opening.attachMicrophone(fake.microphone)).toBe(true);
    expect(opening.attachContext(context)).toBe(true);

    opening.dispose();
    opening.dispose();

    expect(fake.track.stop).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("cleans graph and worker resources that arrive after cancellation", () => {
    const opening = new OpeningSessionResources();
    const graph = fakeGraph();
    const worker = fakeWorker();

    opening.dispose();

    expect(opening.attachGraph(graph)).toBe(false);
    expect(opening.attachWorker(worker)).toBe(false);
    expect(graph.disconnect).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("transfers a complete startup exactly once without premature cleanup", () => {
    const opening = new OpeningSessionResources();
    const fake = fakeMicrophone();
    const context = fakeContext();
    const graph = fakeGraph();
    const worker = fakeWorker();

    expect(opening.attachMicrophone(fake.microphone)).toBe(true);
    expect(opening.attachContext(context)).toBe(true);
    expect(opening.attachGraph(graph)).toBe(true);
    expect(opening.attachWorker(worker)).toBe(true);

    const claimed = opening.claim();
    expect(claimed).toEqual({
      microphone: fake.microphone,
      context,
      graph,
      worker,
    });
    expect(opening.claim()).toBeUndefined();

    opening.dispose();
    expect(fake.track.stop).not.toHaveBeenCalled();
    expect(context.close).not.toHaveBeenCalled();
    expect(graph.disconnect).not.toHaveBeenCalled();
    expect(worker.terminate).not.toHaveBeenCalled();
  });
});
