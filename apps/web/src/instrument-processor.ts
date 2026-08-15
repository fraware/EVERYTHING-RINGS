import {
  ModalInstrumentEngine,
  type ModalInstrumentWorkletEvent,
  type ModalInstrumentWorkletMessage,
} from "@everything-rings/instrument";

declare const currentFrame: number;
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

const PROCESSOR_NAME = "everything-rings-instrument";

class EverythingRingsInstrumentProcessor extends AudioWorkletProcessor {
  private engine: ModalInstrumentEngine | undefined;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<ModalInstrumentWorkletMessage>) => {
      const message = event.data;
      if (message.type === "SET_FINGERPRINT") {
        if (this.engine === undefined) {
          this.engine = new ModalInstrumentEngine(sampleRate, message.fingerprint);
        } else {
          this.engine.setFingerprint(message.fingerprint);
        }
        return;
      }
      if (message.type === "NOTE_ON") {
        const voiceId = this.engine?.noteOn(message.midiNote, message.velocity);
        if (message.eventId !== undefined) {
          const response: ModalInstrumentWorkletEvent = {
            type: "NOTE_STARTED",
            eventId: message.eventId,
            frame: currentFrame,
            voiceId,
          };
          this.port.postMessage(response);
        }
        return;
      }
      this.engine?.allNotesOff();
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0]?.[0];
    if (output === undefined) return true;
    if (this.engine === undefined) output.fill(0);
    else this.engine.process(output);
    return true;
  }
}

registerProcessor(PROCESSOR_NAME, EverythingRingsInstrumentProcessor);
