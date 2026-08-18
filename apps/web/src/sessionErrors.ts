function errorName(error: unknown): string {
  if (error instanceof DOMException) return error.name;
  if (error instanceof Error) return error.name;
  if (typeof error === "object" && error !== null && "name" in error && typeof (error as { name?: unknown }).name === "string") {
    return (error as { name: string }).name;
  }
  return "";
}

export function microphoneStartFailureCopy(
  error: unknown,
  secureContext: boolean | undefined = typeof globalThis.isSecureContext === "boolean" ? globalThis.isSecureContext : undefined,
): string {
  if (secureContext === false) {
    return "Microphone access requires a secure HTTPS page. Open the secure site and try again.";
  }
  switch (errorName(error)) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Microphone access is blocked. Allow microphone access for this site, then try again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No microphone was found. Connect or enable a microphone, then try again.";
    case "NotReadableError":
    case "TrackStartError":
      return "The microphone is unavailable or already in use. Close other audio apps and try again.";
    case "SecurityError":
      return "The browser blocked microphone access for this page. Check site permissions and try again.";
    default:
      return "The audio session could not start. Check microphone permissions, reload the page, and try again.";
  }
}

export function playbackFailureCopy(): string {
  return "Audio playback could not resume after the page became inactive. Tap the sound control again.";
}
