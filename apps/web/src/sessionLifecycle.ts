import type { CaptureGraph, OpenedMicrophone } from "@everything-rings/acquisition";

function stopMicrophone(microphone: OpenedMicrophone): void {
  microphone.stream.getTracks().forEach((track) => {
    try { track.stop(); } catch { /* already stopped */ }
  });
}

function closeContext(context: AudioContext): void {
  try { void context.close().catch(() => undefined); } catch { /* already closed */ }
}

function disconnectGraph(graph: CaptureGraph): void {
  graph.node.port.onmessage = null;
  try { graph.disconnect(); } catch { /* already disconnected */ }
}

function terminateWorker(worker: Worker): void {
  worker.onmessage = null;
  worker.onerror = null;
  try { worker.terminate(); } catch { /* already terminated */ }
}

export class SessionLifecycleGeneration {
  private generation = 0;

  begin(): number {
    this.generation += 1;
    return this.generation;
  }

  invalidate(): void {
    this.generation += 1;
  }

  owns(generation: number): boolean {
    return generation === this.generation;
  }
}

export function ownsSessionResources<T extends object>(
  lifecycle: SessionLifecycleGeneration,
  generation: number,
  current: T | undefined,
  expected: T,
): boolean {
  return lifecycle.owns(generation) && current === expected;
}

export interface ClaimedOpeningSessionResources {
  readonly microphone: OpenedMicrophone;
  readonly context: AudioContext;
  readonly graph: CaptureGraph;
  readonly worker: Worker;
}

export class OpeningSessionResources {
  private microphone: OpenedMicrophone | undefined;
  private context: AudioContext | undefined;
  private graph: CaptureGraph | undefined;
  private worker: Worker | undefined;
  private disposed = false;
  private claimed = false;

  attachMicrophone(microphone: OpenedMicrophone): boolean {
    if (this.disposed || this.claimed) {
      stopMicrophone(microphone);
      return false;
    }
    if (this.microphone !== undefined) throw new Error("Opening session already owns a microphone");
    this.microphone = microphone;
    return true;
  }

  attachContext(context: AudioContext): boolean {
    if (this.disposed || this.claimed) {
      closeContext(context);
      return false;
    }
    if (this.context !== undefined) throw new Error("Opening session already owns an audio context");
    this.context = context;
    return true;
  }

  attachGraph(graph: CaptureGraph): boolean {
    if (this.disposed || this.claimed) {
      disconnectGraph(graph);
      return false;
    }
    if (this.graph !== undefined) throw new Error("Opening session already owns a capture graph");
    this.graph = graph;
    return true;
  }

  attachWorker(worker: Worker): boolean {
    if (this.disposed || this.claimed) {
      terminateWorker(worker);
      return false;
    }
    if (this.worker !== undefined) throw new Error("Opening session already owns an analysis worker");
    this.worker = worker;
    return true;
  }

  claim(): ClaimedOpeningSessionResources | undefined {
    if (this.disposed || this.claimed) return undefined;
    if (
      this.microphone === undefined ||
      this.context === undefined ||
      this.graph === undefined ||
      this.worker === undefined
    ) return undefined;

    const claimed = {
      microphone: this.microphone,
      context: this.context,
      graph: this.graph,
      worker: this.worker,
    };
    this.claimed = true;
    this.microphone = undefined;
    this.context = undefined;
    this.graph = undefined;
    this.worker = undefined;
    return claimed;
  }

  dispose(): void {
    if (this.disposed || this.claimed) return;
    this.disposed = true;

    const worker = this.worker;
    const graph = this.graph;
    const microphone = this.microphone;
    const context = this.context;
    this.worker = undefined;
    this.graph = undefined;
    this.microphone = undefined;
    this.context = undefined;

    if (worker !== undefined) terminateWorker(worker);
    if (graph !== undefined) disconnectGraph(graph);
    if (microphone !== undefined) stopMicrophone(microphone);
    if (context !== undefined) closeContext(context);
  }
}
