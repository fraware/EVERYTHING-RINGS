import type { CaptureConfig } from "./config";
import { MicrophoneStartupError, normalizeMicrophoneStartupFailure } from "./microphone-error";
import type { CaptureSettingsSnapshot } from "./types";
import type { CaptureWorkletMessage } from "./worklet-protocol";

export const CAPTURE_PROCESSOR_NAME = "everything-rings-capture";

export const PREFERRED_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: { ideal: 1 },
  echoCancellation: { ideal: false },
  noiseSuppression: { ideal: false },
  autoGainControl: { ideal: false },
};

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

export async function openMicrophone(): Promise<OpenedMicrophone> {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new MicrophoneStartupError("MIC_INSECURE_CONTEXT");
  }
  if (
    typeof navigator === "undefined"
    || navigator.mediaDevices === undefined
    || typeof navigator.mediaDevices.getUserMedia !== "function"
    || typeof AudioContext === "undefined"
  ) {
    throw new MicrophoneStartupError("MIC_UNSUPPORTED");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: PREFERRED_AUDIO_CONSTRAINTS });
  } catch (error) {
    throw new MicrophoneStartupError(normalizeMicrophoneStartupFailure(error));
  }

  const track = stream.getAudioTracks()[0];
  if (track === undefined) {
    stream.getTracks().forEach((candidate) => candidate.stop());
    throw new MicrophoneStartupError("MIC_NOT_FOUND");
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
