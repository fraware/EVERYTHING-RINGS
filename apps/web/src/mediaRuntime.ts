export type MediaRuntimeFailureReason =
  | "MICROPHONE_PERMISSION_DENIED"
  | "MICROPHONE_NOT_FOUND"
  | "MICROPHONE_UNAVAILABLE"
  | "MICROPHONE_ABORTED"
  | "MICROPHONE_CONSTRAINTS"
  | "MICROPHONE_UNSUPPORTED"
  | "MEDIA_SESSION_ERROR";

interface ErrorLike {
  readonly name?: unknown;
  readonly message?: unknown;
}

export interface ResumableAudioContext {
  readonly state: string;
  resume(): Promise<void>;
}

export function normalizeMediaRuntimeFailure(error: unknown): string {
  const candidate = error as ErrorLike | null | undefined;
  const name = typeof candidate?.name === "string" ? candidate.name : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "MICROPHONE_PERMISSION_DENIED";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "MICROPHONE_NOT_FOUND";
    case "NotReadableError":
    case "TrackStartError":
      return "MICROPHONE_UNAVAILABLE";
    case "AbortError":
      return "MICROPHONE_ABORTED";
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "MICROPHONE_CONSTRAINTS";
    default:
      break;
  }

  const message = typeof candidate?.message === "string" ? candidate.message.trim() : "";
  if (message === "MICROPHONE_UNSUPPORTED") return message;
  return message.length > 0 ? message : "MEDIA_SESSION_ERROR";
}

export async function ensureAudioContextRunning(context: ResumableAudioContext): Promise<boolean> {
  if (context.state === "running") return true;
  if (context.state === "closed") return false;
  try {
    await context.resume();
  } catch {
    return false;
  }
  return context.state === "running";
}
