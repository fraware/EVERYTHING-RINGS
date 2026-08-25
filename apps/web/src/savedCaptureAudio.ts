import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import type { ModalInstrumentWorkletMessage } from "@everything-rings/instrument";
import { renderAcousticFingerprint } from "@everything-rings/synth";
import { SamplePlaybackController } from "./audioPlayback";

export interface SavedCaptureAudioDependencies {
  readonly workletUrl: string;
  createContext(): AudioContext;
  createInstrumentNode(context: AudioContext): AudioWorkletNode;
}

interface SavedCaptureAudioResources {
  readonly context: AudioContext;
  readonly playback: SamplePlaybackController;
  instrument?: AudioWorkletNode;
}

export class SavedCaptureAudioController {
  private resources: SavedCaptureAudioResources | undefined;
  private instrumentPreparation: Promise<AudioWorkletNode | undefined> | undefined;
  private generation = 0;
  private nextEventId = 1;

  constructor(
    private readonly fingerprint: AcousticFingerprintV1,
    private readonly dependencies: SavedCaptureAudioDependencies,
  ) {}

  private async activeResources(): Promise<SavedCaptureAudioResources | undefined> {
    let resources = this.resources;
    if (resources === undefined) {
      const context = this.dependencies.createContext();
      resources = { context, playback: new SamplePlaybackController(context) };
      this.resources = resources;
    }

    const generation = this.generation;
    if (resources.context.state !== "running") await resources.context.resume();
    if (generation !== this.generation || this.resources !== resources) return undefined;
    if (resources.context.state !== "running") throw new Error("Audio output is not active");
    return resources;
  }

  private async ensureInstrument(): Promise<AudioWorkletNode | undefined> {
    const resources = await this.activeResources();
    if (resources === undefined) return undefined;
    if (resources.instrument !== undefined) return resources.instrument;
    if (this.instrumentPreparation !== undefined) return this.instrumentPreparation;

    const generation = this.generation;
    const preparation = (async (): Promise<AudioWorkletNode | undefined> => {
      await resources.context.audioWorklet.addModule(this.dependencies.workletUrl);
      if (generation !== this.generation || this.resources !== resources) return undefined;
      const node = this.dependencies.createInstrumentNode(resources.context);
      node.connect(resources.context.destination);
      const message: ModalInstrumentWorkletMessage = {
        type: "SET_FINGERPRINT",
        fingerprint: this.fingerprint,
      };
      node.port.postMessage(message);
      if (generation !== this.generation || this.resources !== resources) {
        try { node.disconnect(); } catch { /* already disconnected */ }
        return undefined;
      }
      resources.instrument = node;
      return node;
    })();

    this.instrumentPreparation = preparation;
    try {
      return await preparation;
    } finally {
      if (this.instrumentPreparation === preparation) this.instrumentPreparation = undefined;
    }
  }

  async playModel(): Promise<boolean> {
    const resources = await this.activeResources();
    if (resources === undefined) return false;
    const samples = renderAcousticFingerprint(this.fingerprint, resources.context.sampleRate);
    await resources.playback.play(samples, resources.context.sampleRate);
    return this.resources === resources;
  }

  async playMode(modeIndex: number): Promise<boolean> {
    const mode = this.fingerprint.modes[modeIndex];
    if (mode === undefined) throw new RangeError("modeIndex is outside the saved fingerprint");
    const resources = await this.activeResources();
    if (resources === undefined) return false;
    const samples = renderAcousticFingerprint(
      { ...this.fingerprint, modes: [mode] },
      resources.context.sampleRate,
    );
    await resources.playback.play(samples, resources.context.sampleRate);
    return this.resources === resources;
  }

  async noteOn(midiNote: number, velocity = 1): Promise<boolean> {
    if (!Number.isInteger(midiNote) || midiNote < 0 || midiNote > 127) {
      throw new RangeError("midiNote must be an integer in [0, 127]");
    }
    if (!Number.isFinite(velocity) || velocity <= 0 || velocity > 1) {
      throw new RangeError("velocity must be finite and in (0, 1]");
    }
    const node = await this.ensureInstrument();
    if (node === undefined) return false;
    const message: ModalInstrumentWorkletMessage = {
      type: "NOTE_ON",
      midiNote,
      velocity,
      eventId: this.nextEventId,
    };
    this.nextEventId += 1;
    node.port.postMessage(message);
    return true;
  }

  silence(): void {
    const resources = this.resources;
    resources?.playback.stop();
    resources?.instrument?.port.postMessage({ type: "ALL_NOTES_OFF" } satisfies ModalInstrumentWorkletMessage);
  }

  dispose(): void {
    this.generation += 1;
    const resources = this.resources;
    this.resources = undefined;
    this.instrumentPreparation = undefined;
    if (resources === undefined) return;
    resources.playback.stop();
    resources.instrument?.port.postMessage({ type: "ALL_NOTES_OFF" } satisfies ModalInstrumentWorkletMessage);
    try { resources.instrument?.disconnect(); } catch { /* already disconnected */ }
    void resources.context.close();
  }
}
