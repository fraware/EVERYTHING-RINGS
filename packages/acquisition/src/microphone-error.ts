export type MicrophoneStartupFailure =
  | "MIC_PERMISSION_DENIED"
  | "MIC_NOT_FOUND"
  | "MIC_BUSY"
  | "MIC_UNSUPPORTED"
  | "MIC_INSECURE_CONTEXT"
  | "MIC_START_FAILED";

interface ErrorLike {
  readonly name?: string;
}

export class MicrophoneStartupError extends Error {
  readonly code: MicrophoneStartupFailure;

  constructor(code: MicrophoneStartupFailure) {
    super(code);
    this.name = "MicrophoneStartupError";
    this.code = code;
  }
}

export function normalizeMicrophoneStartupFailure(error: unknown): MicrophoneStartupFailure {
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
