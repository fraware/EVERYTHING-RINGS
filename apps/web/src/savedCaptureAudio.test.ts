import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { describe, expect, it, vi } from "vitest";
import { SavedCaptureAudioController, type SavedCaptureAudioDependencies } from "./savedCaptureAudio";

const FINGERPRINT: AcousticFingerprintV1 = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48_000,
  durationSeconds: 0.12,
  modes: [{
    frequencyHz: 440,
    relativeAmplitude: 1,
    decaySeconds: 0.08,
    q: 110,
    confidence: 0.95,
    diagnostics: {
      prominenceDb: 20,
      persistenceSeconds: 0.07,
      frequencyStdCents: 2,
      decayFitScore: 0.94,
      observationCount: 14,
    },
  }],
};

function fakeDependencies() {
  const sources: Array<{
    onended: (() => void) | null;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    buffer: AudioBuffer | null;
  }> = [];
  const messages: unknown[] = [];
  const instrument = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    port: { postMessage: vi.fn((message: unknown) => messages.push(message)) },
  };
  const context = {
    state: "suspended" as AudioContextState,
    sampleRate: 48_000,
    destination: {},
    audioWorklet: { addModule: vi.fn(async (): Promise<void> => undefined) },
    resume: vi.fn(async () => { context.state = "running"; }),
    close: vi.fn(async () => { context.state = "closed"; }),
    createBuffer: vi.fn(() => ({ copyToChannel: vi.fn() })),
    createBufferSource: vi.fn(() => {
      const source = {
        onended: null,
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        buffer: null,
      };
      sources.push(source);
      return source;
    }),
  };
  const dependencies: SavedCaptureAudioDependencies = {
    workletUrl: "/instrument.js",
    createContext: vi.fn(() => context as unknown as AudioContext),
    createInstrumentNode: vi.fn(() => instrument as unknown as AudioWorkletNode),
  };
  return { dependencies, context, instrument, messages, sources };
}

describe("SavedCaptureAudioController", () => {
  it("plays the saved model without loading realtime instrument resources", async () => {
    const fake = fakeDependencies();
    const player = new SavedCaptureAudioController(FINGERPRINT, fake.dependencies);

    await expect(player.playModel()).resolves.toBe(true);
    expect(fake.dependencies.createContext).toHaveBeenCalledOnce();
    expect(fake.context.resume).toHaveBeenCalledOnce();
    expect(fake.context.audioWorklet.addModule).not.toHaveBeenCalled();
    expect(fake.dependencies.createInstrumentNode).not.toHaveBeenCalled();
    expect(fake.sources[0]?.start).toHaveBeenCalledOnce();
  });

  it("loads the realtime instrument once and binds the saved fingerprint before notes", async () => {
    const fake = fakeDependencies();
    const player = new SavedCaptureAudioController(FINGERPRINT, fake.dependencies);

    await expect(player.noteOn(60)).resolves.toBe(true);
    await expect(player.noteOn(64, 0.7)).resolves.toBe(true);

    expect(fake.context.audioWorklet.addModule).toHaveBeenCalledTimes(1);
    expect(fake.dependencies.createInstrumentNode).toHaveBeenCalledTimes(1);
    expect(fake.messages[0]).toEqual({ type: "SET_FINGERPRINT", fingerprint: FINGERPRINT });
    expect(fake.messages[1]).toMatchObject({ type: "NOTE_ON", midiNote: 60, velocity: 1 });
    expect(fake.messages[2]).toMatchObject({ type: "NOTE_ON", midiNote: 64, velocity: 0.7 });
  });

  it("rejects invalid mode and note requests", async () => {
    const fake = fakeDependencies();
    const player = new SavedCaptureAudioController(FINGERPRINT, fake.dependencies);

    await expect(player.playMode(5)).rejects.toThrow(RangeError);
    await expect(player.noteOn(128)).rejects.toThrow(RangeError);
    await expect(player.noteOn(60, 0)).rejects.toThrow(RangeError);
    expect(fake.dependencies.createContext).not.toHaveBeenCalled();
  });

  it("silences playback and realtime notes and closes resources on dispose", async () => {
    const fake = fakeDependencies();
    const player = new SavedCaptureAudioController(FINGERPRINT, fake.dependencies);
    await player.playModel();
    await player.noteOn(60);

    player.silence();
    expect(fake.sources[0]?.stop).toHaveBeenCalledOnce();
    expect(fake.messages.at(-1)).toEqual({ type: "ALL_NOTES_OFF" });

    player.dispose();
    expect(fake.instrument.disconnect).toHaveBeenCalledOnce();
    expect(fake.context.close).toHaveBeenCalledOnce();
  });

  it("does not create a worklet node if disposal wins an in-flight module load", async () => {
    const fake = fakeDependencies();
    let releaseModule!: () => void;
    let markModuleStarted!: () => void;
    const moduleStarted = new Promise<void>((resolve) => {
      markModuleStarted = resolve;
    });
    fake.context.audioWorklet.addModule.mockImplementation(() => {
      markModuleStarted();
      return new Promise<void>((resolve) => {
        releaseModule = resolve;
      });
    });
    const player = new SavedCaptureAudioController(FINGERPRINT, fake.dependencies);

    const note = player.noteOn(60);
    await moduleStarted;
    player.dispose();
    releaseModule();

    await expect(note).resolves.toBe(false);
    expect(fake.dependencies.createInstrumentNode).not.toHaveBeenCalled();
    expect(fake.context.close).toHaveBeenCalledOnce();
  });
});
