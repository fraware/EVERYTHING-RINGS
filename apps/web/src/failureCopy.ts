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
    case undefined:
      return "The capture could not be analyzed.";
    default:
      return reason;
  }
}
