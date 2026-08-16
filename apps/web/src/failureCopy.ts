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
    case "MIC_PERMISSION_DENIED":
      return "Microphone access is blocked. Allow microphone access for this site, then try again.";
    case "MIC_NOT_FOUND":
      return "No microphone is available on this device.";
    case "MIC_BUSY":
      return "The microphone could not be opened. Close other apps using it, then try again.";
    case "MIC_INSECURE_CONTEXT":
      return "Microphone access needs a secure HTTPS connection.";
    case "MIC_UNSUPPORTED":
      return "This browser does not provide the microphone features needed here.";
    case "MIC_START_FAILED":
      return "The microphone could not be started. Check the device and browser permissions, then try again.";
    case undefined:
      return "The capture could not be analyzed.";
    default:
      return reason;
  }
}
