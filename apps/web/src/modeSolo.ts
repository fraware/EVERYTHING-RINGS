import type { AcousticFingerprintV1 } from "@everything-rings/dsp";

export function fingerprintForMode(
  fingerprint: AcousticFingerprintV1,
  modeIndex: number,
): AcousticFingerprintV1 | undefined {
  if (!Number.isInteger(modeIndex) || modeIndex < 0) return undefined;
  const mode = fingerprint.modes[modeIndex];
  if (mode === undefined) return undefined;
  return { ...fingerprint, modes: [mode] };
}
