import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";
import { chooseAnchorMode, midiNoteFrequency } from "./playable";

export interface RealtimeInstrumentConfig {
  readonly attackSeconds: number;
  readonly amplitudeExponent: number;
  readonly outputPeak: number;
  readonly maximumVoices: number;
  readonly maximumModesPerVoice: number;
  readonly nyquistMargin: number;
  readonly silenceThreshold: number;
  readonly maximumVoiceSeconds: number;
}

export const DEFAULT_REALTIME_INSTRUMENT_CONFIG: RealtimeInstrumentConfig = {
  attackSeconds: 0.003,
  amplitudeExponent: 0.8,
  outputPeak: 0.9,
  maximumVoices: 8,
  maximumModesPerVoice: 16,
  nyquistMargin: 0.98,
  silenceThreshold: 1e-4,
  maximumVoiceSeconds: 8,
};

interface VoiceModeState {
  phase: number;
  readonly phaseStep: number;
  envelope: number;
  readonly decayMultiplier: number;
  readonly amplitude: number;
}

interface VoiceState {
  readonly id: number;
  ageSamples: number;
  readonly modes: VoiceModeState[];
}

function validateConfig(config: RealtimeInstrumentConfig): void {
  if (!(config.attackSeconds >= 0) || !Number.isFinite(config.attackSeconds)) throw new RangeError("attackSeconds must be finite and non-negative");
  if (!(config.amplitudeExponent > 0) || !Number.isFinite(config.amplitudeExponent)) throw new RangeError("amplitudeExponent must be finite and positive");
  if (!(config.outputPeak > 0 && config.outputPeak <= 1) || !Number.isFinite(config.outputPeak)) throw new RangeError("outputPeak must be finite and in (0, 1]");
  if (!Number.isInteger(config.maximumVoices) || config.maximumVoices <= 0) throw new RangeError("maximumVoices must be a positive integer");
  if (!Number.isInteger(config.maximumModesPerVoice) || config.maximumModesPerVoice <= 0) throw new RangeError("maximumModesPerVoice must be a positive integer");
  if (!(config.nyquistMargin > 0 && config.nyquistMargin < 1) || !Number.isFinite(config.nyquistMargin)) throw new RangeError("nyquistMargin must be finite and in (0, 1)");
  if (!(config.silenceThreshold > 0 && config.silenceThreshold < 1) || !Number.isFinite(config.silenceThreshold)) throw new RangeError("silenceThreshold must be finite and in (0, 1)");
  if (!(config.maximumVoiceSeconds > 0) || !Number.isFinite(config.maximumVoiceSeconds)) throw new RangeError("maximumVoiceSeconds must be finite and positive");
}

function attackGain(ageSamples: number, attackSamples: number): number {
  if (attackSamples <= 0 || ageSamples >= attackSamples) return 1;
  return 0.5 - 0.5 * Math.cos(Math.PI * ageSamples / attackSamples);
}

function modalWeight(mode: AcousticMode, exponent: number): number {
  return Math.max(0, mode.relativeAmplitude) ** exponent;
}

function remainingVoiceEnergy(voice: VoiceState): number {
  return voice.modes.reduce((sum, mode) => sum + Math.abs(mode.amplitude * mode.envelope), 0);
}

function quietestVoiceIndex(voices: readonly VoiceState[]): number {
  let quietestIndex = 0;
  let quietestEnergy = Number.POSITIVE_INFINITY;
  for (let index = 0; index < voices.length; index += 1) {
    const voice = voices[index];
    if (voice === undefined) continue;
    const energy = remainingVoiceEnergy(voice);
    if (energy < quietestEnergy) {
      quietestEnergy = energy;
      quietestIndex = index;
    }
  }
  return quietestIndex;
}

export class ModalInstrumentEngine {
  private fingerprint: AcousticFingerprintV1;
  private readonly config: RealtimeInstrumentConfig;
  private readonly attackSamples: number;
  private readonly maximumVoiceSamples: number;
  private voices: VoiceState[] = [];
  private nextVoiceId = 1;

  constructor(readonly sampleRate: number, fingerprint: AcousticFingerprintV1, config: RealtimeInstrumentConfig = DEFAULT_REALTIME_INSTRUMENT_CONFIG) {
    if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) throw new RangeError("sampleRate must be finite and positive");
    validateConfig(config);
    this.fingerprint = fingerprint;
    this.config = config;
    this.attackSamples = Math.round(config.attackSeconds * sampleRate);
    this.maximumVoiceSamples = Math.round(config.maximumVoiceSeconds * sampleRate);
  }

  get activeVoiceCount(): number { return this.voices.length; }

  setFingerprint(fingerprint: AcousticFingerprintV1): void {
    this.fingerprint = fingerprint;
    this.allNotesOff();
  }

  noteOn(midiNote: number, velocity = 1): number {
    if (!(velocity >= 0 && velocity <= 1) || !Number.isFinite(velocity)) throw new RangeError("velocity must be finite and in [0, 1]");
    const anchor = chooseAnchorMode(this.fingerprint);
    if (anchor === undefined) throw new Error("Cannot play a fingerprint with no positive-frequency modes");
    const frequencyScale = midiNoteFrequency(midiNote) / anchor.frequencyHz;
    const maximumFrequencyHz = this.sampleRate * 0.5 * this.config.nyquistMargin;
    const candidates = this.fingerprint.modes
      .filter((mode) => mode.frequencyHz > 0 && mode.decaySeconds > 0 && mode.relativeAmplitude > 0)
      .filter((mode) => mode.frequencyHz * frequencyScale < maximumFrequencyHz)
      .slice(0, this.config.maximumModesPerVoice);
    const weightSum = candidates.reduce((sum, mode) => sum + modalWeight(mode, this.config.amplitudeExponent), 0);
    const normalization = weightSum > 0 ? this.config.outputPeak / weightSum : 0;
    const modes = candidates.map((mode): VoiceModeState => {
      const frequencyHz = mode.frequencyHz * frequencyScale;
      return {
        phase: 0,
        phaseStep: 2 * Math.PI * frequencyHz / this.sampleRate,
        envelope: 1,
        decayMultiplier: Math.exp(-1 / (mode.decaySeconds * this.sampleRate)),
        amplitude: velocity * normalization * modalWeight(mode, this.config.amplitudeExponent),
      };
    });
    const id = this.nextVoiceId;
    this.nextVoiceId += 1;
    if (modes.length === 0 || velocity === 0) return id;
    if (this.voices.length >= this.config.maximumVoices) this.voices.splice(quietestVoiceIndex(this.voices), 1);
    this.voices.push({ id, ageSamples: 0, modes });
    return id;
  }

  allNotesOff(): void { this.voices = []; }

  process(output: Float32Array): void {
    output.fill(0);
    const voiceCount = this.voices.length;
    if (voiceCount === 0) return;
    const polyphonyGain = 1 / voiceCount;
    for (let sampleIndex = 0; sampleIndex < output.length; sampleIndex += 1) {
      let mixed = 0;
      for (const voice of this.voices) {
        const gain = attackGain(voice.ageSamples, this.attackSamples);
        let voiceSample = 0;
        for (const mode of voice.modes) {
          voiceSample += mode.amplitude * mode.envelope * Math.sin(mode.phase);
          mode.phase += mode.phaseStep;
          if (mode.phase >= 2 * Math.PI) mode.phase -= 2 * Math.PI;
          mode.envelope *= mode.decayMultiplier;
        }
        mixed += gain * voiceSample;
        voice.ageSamples += 1;
      }
      output[sampleIndex] = mixed * polyphonyGain;
    }
    this.voices = this.voices.filter((voice) => {
      if (voice.ageSamples >= this.maximumVoiceSamples) return false;
      return voice.modes.some((mode) => mode.amplitude * mode.envelope >= this.config.silenceThreshold);
    });
  }
}
