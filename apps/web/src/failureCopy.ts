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
    case "MICROPHONE_PERMISSION_DENIED":
      return "Microphone access is blocked. Allow microphone access in your browser, then try again.";
    case "MICROPHONE_NOT_FOUND":
      return "No microphone is available on this device.";
    case "MICROPHONE_UNAVAILABLE":
      return "The microphone is unavailable. Close other apps using it, then try again.";
    case "MICROPHONE_ABORTED":
      return "Microphone startup was interrupted. Try again.";
    case "MICROPHONE_CONSTRAINTS":
      return "This browser could not open the microphone with the requested audio settings.";
    case "MICROPHONE_UNSUPPORTED":
      return "This browser cannot provide microphone access here. Use a current browser over HTTPS.";
    case "MEDIA_SESSION_ERROR":
      return "The audio session could not start.";
    case undefined:
      return "The capture could not be analyzed.";
    default:
      return reason;
  }
}
