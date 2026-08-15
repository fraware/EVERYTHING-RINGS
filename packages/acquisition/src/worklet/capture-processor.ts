import { DEFAULT_CAPTURE_CONFIG, type CaptureConfig } from "../config";
import { ImpactCaptureEngine } from "../engine";
import type { CaptureWorkletEvent, CaptureWorkletMessage } from "../worklet-protocol";

declare const sampleRate: number;
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}
declare function registerProcessor(
  name: string,
  processorCtor: new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor,
): void;

const PROCESSOR_NAME = "everything-rings-capture";

class EverythingRingsCaptureProcessor extends AudioWorkletProcessor {
  private config: CaptureConfig = DEFAULT_CAPTURE_CONFIG;
  private engine = new ImpactCaptureEngine(sampleRate, this.config);

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<CaptureWorkletMessage>) => {
      if (event.data.type === "CONFIGURE") {
        this.config = event.data.config;
        this.engine = new ImpactCaptureEngine(sampleRate, this.config);
        this.emitState();
      } else if (event.data.type === "RESET") {
        this.engine.reset();
        this.emitState();
      }
    };
    this.emitState();
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (input === undefined) return true;
    if (output !== undefined) output.set(input.subarray(0, output.length));

    const previousState = this.engine.state;
    const events = this.engine.processBlock(input);
    if (this.engine.state !== previousState) this.emitState();
    for (const event of events) {
      if (event.type !== "COMPLETE") continue;
      const message: CaptureWorkletEvent = { type: "CAPTURE_COMPLETE", capture: event.capture };
      this.port.postMessage(message, [event.capture.samples.buffer]);
    }
    return true;
  }

  private emitState(): void {
    const message: CaptureWorkletEvent = { type: "STATE", state: this.engine.state };
    this.port.postMessage(message);
  }
}

registerProcessor(PROCESSOR_NAME, EverythingRingsCaptureProcessor);
