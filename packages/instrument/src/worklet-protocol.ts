import type { AcousticFingerprintV1 } from "@everything-rings/dsp";

export type ModalInstrumentWorkletMessage =
  | { readonly type: "SET_FINGERPRINT"; readonly fingerprint: AcousticFingerprintV1 }
  | { readonly type: "NOTE_ON"; readonly midiNote: number; readonly velocity?: number }
  | { readonly type: "ALL_NOTES_OFF" };
