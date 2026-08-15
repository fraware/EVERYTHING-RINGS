import type { CaptureConfig } from "./config";
import type { CaptureSettingsSnapshot } from "./types";
import type { CaptureWorkletMessage } from "./worklet-protocol";

export const CAPTURE_PROCESSOR_NAME = "everything-rings-capture";

export const PREFERRED_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: { ideal: 1 },
  echoCancellation: { ideal: false },
  noiseSuppression: { ideal: false },
  autoGainControl: { ideal: false },
};

export type MicrophoneOpenFailureReason =
  | "SECURE_CONTEXT_REQUIRED"
  | "MICROPHONE_UNSUPPORTED"
  | "MICROPHONE_PERMISSION_DENIED"
  | "MICROPHONE_NOT_FOUND"
  | "MICROPHONE_UNAVAILABLE"
  | "MICROPHONE_CONSTRAINTS_UNSATISFIED"
  | "MICROPHONE_OPEN_FAILED";

export class MicrophoneOpenError extends Error {
  readonly name = "MicrophoneOpenError";

  constructor(readonly reason: MicrophoneOpenFailureReason) {
    super(reason);
  }
}

export interface OpenedMicrophone {
  readonly stream: MediaStream;
  readonly track: MediaStreamTrack;
  readonly settings: CaptureSettingsSnapshot;
}

export interface CaptureGraph {
  readonly source: MediaStreamAudioSourceNode;
  readonly node: AudioWorkletNode;
  readonly silentGain: GainNode;
  disconnect(): void;
}

function settingsSnapshot(settings: MediaTrackSettings): CaptureSettingsSnapshot {
  const snapshot: {
    sampleRate?: number;
    channelCount?: number;
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
    deviceId?: string;
  } = {};
  if (settings.sampleRate !== undefined) snapshot.sampleRate = settings.sampleRate;
  if (settings.channelCount !== undefined) snapshot.channelCount = settings.channelCount;
  if (settings.echoCancellation !== undefined) snapshot.echoCancellation = settings.echoCancellation;
  if (settings.noiseSuppression !== undefined) snapshot.noiseSuppression = settings.noiseSuppression;
  if (settings.autoGainControl !== undefined) snapshot.autoGainControl = settings.autoGainControl;
  if (settings.deviceId !== undefined) snapshot.deviceId = settings.deviceId;
  return snapshot;
}

function errorName(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("name" in error)) return undefined;
  const name = (error as { readonly name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
}

export function classifyMicrophoneOpenFailure(error: unknown): MicrophoneOpenFailureReason {
  switch (errorName(error)) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "MICROPHONE_PERMISSION_DENIED";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "MICROPHONE_NOT_FOUND";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "MICROPHONE_UNAVAILABLE";
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "MICROPHONE_CONSTRAINTS_UNSATISFIED";
    default:
      return "MICROPHONE_OPEN_FAILED";
  }
}

export async function openMicrophone(): Promise<OpenedMicrophone> {
  if (typeof isSecureContext === "boolean" && !isSecureContext) {
    throw new MicrophoneOpenError("SECURE_CONTEXT_REQUIRED");
  }
  if (typeof navigator === "undefined" || navigator.mediaDevices === undefined || typeof navigator.mediaDevices.getUserMedia !== "function") {
    throw new MicrophoneOpenError("MICROPHONE_UNSUPPORTED");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: PREFERRED_AUDIO_CONSTRAINTS });
  } catch (error) {
    throw new MicrophoneOpenError(classifyMicrophoneOpenFailure(error));
  }

  const track = stream.getAudioTracks()[0];
  if (track === undefined) {
    stream.getTracks().forEach((candidate) => candidate.stop());
    throw new MicrophoneOpenError("MICROPHONE_NOT_FOUND");
  }
  try {
    track.contentHint = "music";
  } catch {
    // Advisory only. Capture remains valid if the browser declines the hint.
  }
  return { stream, track, settings: settingsSnapshot(track.getSettings()) };
}

export async function createCaptureGraph(
  audioContext: AudioContext,
  stream: MediaStream,
  workletModuleUrl: string | URL,
  config?: CaptureConfig,
): Promise<CaptureGraph> {
  await audioContext.audioWorklet.addModule(workletModuleUrl);
  const source = audioContext.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(audioContext, CAPTURE_PROCESSOR_NAME, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    channelCount: 1,
    channelCountMode: "explicit",
  });
  if (config !== undefined) {
    const message: CaptureWorkletMessage = { type: "CONFIGURE", config };
    node.port.postMessage(message);
  }
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;
  source.connect(node).connect(silentGain).connect(audioContext.destination);
  return {
    source,
    node,
    silentGain,
    disconnect() {
      source.disconnect();
      node.disconnect();
      silentGain.disconnect();
    },
  };
}
