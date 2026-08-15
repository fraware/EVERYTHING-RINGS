export function failureCopy(reason: string | undefined): string {
  switch (reason) {
    case "TOO_QUIET":
      return "The strike was too quiet. Move closer or try a more resonant object.";
    case "CLIPPED":
      return "The strike overloaded the microphone. Move the device farther away and try again.";
    case "LOW_SNR":
      return "Background sound masked the ring. Try again somewhere quieter.";
    case "MULTIPLE_IMPACTS":
      return "More than one strong impact was detected. Strike the object once.";
    case "NO_STABLE_RESONANCES":
      return "No stable resonances were strong enough to reveal.";
    case "SIGNAL_TOO_SHORT":
      return "The captured ring was too short to analyze.";
    case "SECURE_CONTEXT_REQUIRED":
      return "Microphone access requires a secure connection. Open this experience over HTTPS and try again.";
    case "MICROPHONE_UNSUPPORTED":
      return "This browser cannot open a microphone for this experience. Try a current browser with microphone support.";
    case "MICROPHONE_PERMISSION_DENIED":
      return "Microphone access is blocked. Allow microphone access for this site, then try again.";
    case "MICROPHONE_NOT_FOUND":
      return "No microphone was found. Connect or enable a microphone, then try again.";
    case "MICROPHONE_UNAVAILABLE":
      return "The microphone is unavailable or already in use. Close other audio apps and try again.";
    case "MICROPHONE_CONSTRAINTS_UNSATISFIED":
      return "This microphone could not provide a compatible capture stream. Try another input or browser.";
    case "MICROPHONE_OPEN_FAILED":
      return "The microphone could not be opened. Check the input and try again.";
    case "MICROPHONE_DISCONNECTED":
      return "The microphone disconnected. Reconnect or reselect the input, then start again.";
    case undefined:
      return "The capture could not be analyzed.";
    default:
      return reason;
  }
}
