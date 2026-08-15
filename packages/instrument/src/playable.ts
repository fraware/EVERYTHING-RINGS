import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";
import {
  DEFAULT_MODAL_RENDER_CONFIG,
  renderAcousticFingerprint,
  type ModalRenderConfig,
} from "@everything-rings/synth";

export interface AnchorConfig {
  readonly minimumFrequencyHz: number;
  readonly maximumFrequencyHz: number;
}

export const DEFAULT_ANCHOR_CONFIG: AnchorConfig = {
  minimumFrequencyHz: 80,
  maximumFrequencyHz: 2000,
};

export interface PlayableNote {
  readonly midiNote: number;
  readonly targetFrequencyHz: number;
  readonly anchorFrequencyHz: number;
  readonly frequencyScale: number;
  readonly samples: Float32Array;
}

export function midiNoteFrequency(midiNote: number): number {
  if (!Number.isInteger(midiNote) || midiNote < 0 || midiNote > 127) {
    throw new RangeError("midiNote must be an integer in [0, 127]");
  }
  return 440 * 2 ** ((midiNote - 69) / 12);
}

function anchorScore(mode: AcousticMode): number {
  return mode.confidence * Math.sqrt(mode.relativeAmplitude);
}

export function chooseAnchorMode(
  fingerprint: AcousticFingerprintV1,
  config: AnchorConfig = DEFAULT_ANCHOR_CONFIG,
): AcousticMode | undefined {
  if (!(config.minimumFrequencyHz > 0) || !(config.maximumFrequencyHz > config.minimumFrequencyHz)) {
    throw new RangeError("anchor frequency range is invalid");
  }
  const eligible = fingerprint.modes.filter(
    (mode) => mode.frequencyHz >= config.minimumFrequencyHz && mode.frequencyHz <= config.maximumFrequencyHz,
  );
  const candidates = eligible.length > 0 ? eligible : fingerprint.modes.filter((mode) => mode.frequencyHz > 0);
  return [...candidates].sort((left, right) => {
    const scoreDifference = anchorScore(right) - anchorScore(left);
    return scoreDifference !== 0 ? scoreDifference : left.frequencyHz - right.frequencyHz;
  })[0];
}

export function frequencyScaleForMidiNote(
  fingerprint: AcousticFingerprintV1,
  midiNote: number,
  anchorConfig: AnchorConfig = DEFAULT_ANCHOR_CONFIG,
): number {
  const anchor = chooseAnchorMode(fingerprint, anchorConfig);
  if (anchor === undefined) throw new Error("Cannot play a fingerprint with no positive-frequency modes");
  return midiNoteFrequency(midiNote) / anchor.frequencyHz;
}

export function renderPlayableNote(
  fingerprint: AcousticFingerprintV1,
  midiNote: number,
  sampleRate: number = fingerprint.sampleRate,
  renderConfig: ModalRenderConfig = DEFAULT_MODAL_RENDER_CONFIG,
  anchorConfig: AnchorConfig = DEFAULT_ANCHOR_CONFIG,
): PlayableNote {
  const anchor = chooseAnchorMode(fingerprint, anchorConfig);
  if (anchor === undefined) throw new Error("Cannot play a fingerprint with no positive-frequency modes");
  const targetFrequencyHz = midiNoteFrequency(midiNote);
  const frequencyScale = targetFrequencyHz / anchor.frequencyHz;
  const samples = renderAcousticFingerprint(fingerprint, sampleRate, {
    ...renderConfig,
    frequencyScale,
  });
  return {
    midiNote,
    targetFrequencyHz,
    anchorFrequencyHz: anchor.frequencyHz,
    frequencyScale,
    samples,
  };
}
