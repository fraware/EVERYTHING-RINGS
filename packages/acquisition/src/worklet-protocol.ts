import type { CaptureConfig } from "./config";
import type { AudioCapture, CaptureState } from "./types";

export type CaptureWorkletMessage =
  | { readonly type: "CONFIGURE"; readonly config: CaptureConfig }
  | { readonly type: "RESET" };

export type CaptureWorkletEvent =
  | { readonly type: "STATE"; readonly state: CaptureState }
  | { readonly type: "CAPTURE_COMPLETE"; readonly capture: AudioCapture };
