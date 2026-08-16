export type MicrophoneStartupFailure =
  | "MIC_PERMISSION_DENIED"
  | "MIC_NOT_FOUND"
  | "MIC_BUSY"
  | "MIC_UNSUPPORTED"
  | "MIC_INSECURE_CONTEXT"
  | "MIC_START_FAILED";

interface ErrorLike {
  readonly name?: string;
  readonly message?: string;
}

export function normalizeMicrophoneStartupFailure(error: unknown): MicrophoneStartupFailure {
  if (typeof window !== "undefined" && !window.isSecureContext) return "MIC_INSECURE_CONTEXT";
  if (
    typeof navigator === "undefined"
    || navigator.mediaDevices === undefined
    || typeof navigator.mediaDevices.getUserMedia !== "function"
    || typeof AudioContext === "undefined"
  ) {
    return "MIC_UNSUPPORTED";
  }
  const candidate = error as ErrorLike | null | undefined;
  switch (candidate?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "MIC_PERMISSION_DENIED";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "MIC_NOT_FOUND";
    case "NotReadableError":
    case "TrackStartError":
      return "MIC_BUSY";
    case "SecurityError":
      return "MIC_INSECURE_CONTEXT";
    case "NotSupportedError":
      return "MIC_UNSUPPORTED";
    default:
      return "MIC_START_FAILED";
  }
}
