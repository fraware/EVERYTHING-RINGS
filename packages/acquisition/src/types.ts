export type CaptureState = "warming" | "armed" | "capturing" | "complete";

export interface CaptureSettingsSnapshot {
  readonly sampleRate?: number;
  readonly channelCount?: number;
  readonly echoCancellation?: boolean;
  readonly noiseSuppression?: boolean;
  readonly autoGainControl?: boolean;
  readonly deviceId?: string;
}

export interface AudioCapture {
  readonly samples: Float32Array;
  readonly sampleRate: number;
  readonly triggerSample: number;
}

export type CaptureEngineEvent =
  | { readonly type: "ARMED" }
  | { readonly type: "TRIGGERED"; readonly triggerSample: number }
  | { readonly type: "COMPLETE"; readonly capture: AudioCapture };
