import {
  isAcousticFingerprintAlgorithmVersion,
  type AcousticFingerprintV1,
  type AcousticMode,
} from "@everything-rings/dsp";
import { fingerprintSignature } from "@everything-rings/visual";

export const ACOUSTIC_CAPSULE_VERSION = 1;
export const ACOUSTIC_CAPSULE_FRAGMENT_PREFIX = "#ring=";
export const MAX_ACOUSTIC_CAPSULE_FRAGMENT_LENGTH = 8_192;
export const MAX_ACOUSTIC_CAPSULE_MODES = 16;
export const MAX_ACOUSTIC_CAPSULE_DURATION_SECONDS = 8;

const MINIMUM_MODE_FREQUENCY_HZ = 80;
const MAXIMUM_MODE_FREQUENCY_HZ = 12_000;
const MINIMUM_RELATIVE_AMPLITUDE = 0.001;
const MINIMUM_MODE_CONFIDENCE = 0.55;
const MINIMUM_TRACK_PERSISTENCE_SECONDS = 0.08;
const MAXIMUM_FREQUENCY_STD_CENTS = 18;
const MINIMUM_TRACK_OBSERVATIONS = 8;
const MINIMUM_PROMINENCE_DB = 8;
const Q_RELATIVE_TOLERANCE = 1e-3;

export type AcousticCapsuleFailureReason =
  | "missing"
  | "too-large"
  | "encoding"
  | "shape"
  | "unsupported-version"
  | "unsupported-algorithm"
  | "signature";

export type AcousticCapsuleParseResult =
  | {
    readonly ok: true;
    readonly fingerprint: AcousticFingerprintV1;
    readonly signature: string;
  }
  | {
    readonly ok: false;
    readonly reason: AcousticCapsuleFailureReason;
  };

type WireMode = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

interface WireCapsuleV1 {
  readonly v: 1;
  readonly a: string;
  readonly r: number;
  readonly d: number;
  readonly s: string;
  readonly m: readonly WireMode[];
}

const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

function approximatelyEqual(left: number, right: number, relativeTolerance: number): boolean {
  const scale = Math.max(Math.abs(left), Math.abs(right), Number.MIN_VALUE);
  return Math.abs(left - right) / scale <= relativeTolerance;
}

function encodeAsciiBase64Url(value: string): string {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0x7f) throw new RangeError("Acoustic Capsule payload must be ASCII");
  }

  let output = "";
  for (let index = 0; index < value.length; index += 3) {
    const first = value.charCodeAt(index);
    const hasSecond = index + 1 < value.length;
    const hasThird = index + 2 < value.length;
    const second = hasSecond ? value.charCodeAt(index + 1) : 0;
    const third = hasThird ? value.charCodeAt(index + 2) : 0;

    output += BASE64URL_ALPHABET[first >> 2];
    output += BASE64URL_ALPHABET[((first & 0x03) << 4) | (second >> 4)];
    if (hasSecond) output += BASE64URL_ALPHABET[((second & 0x0f) << 2) | (third >> 6)];
    if (hasThird) output += BASE64URL_ALPHABET[third & 0x3f];
  }
  return output;
}

function decodeAsciiBase64Url(value: string): string | undefined {
  if (value.length === 0 || value.length % 4 === 1 || !/^[A-Za-z0-9_-]+$/.test(value)) return undefined;

  let accumulator = 0;
  let bitCount = 0;
  let output = "";
  for (const character of value) {
    const sextet = BASE64URL_ALPHABET.indexOf(character);
    if (sextet < 0) return undefined;
    accumulator = (accumulator << 6) | sextet;
    bitCount += 6;
    while (bitCount >= 8) {
      bitCount -= 8;
      const byte = (accumulator >> bitCount) & 0xff;
      if (byte > 0x7f) return undefined;
      output += String.fromCharCode(byte);
      accumulator &= bitCount === 0 ? 0 : (1 << bitCount) - 1;
    }
  }
  if (bitCount > 0 && accumulator !== 0) return undefined;
  return output;
}

function wireMode(mode: AcousticMode): WireMode {
  return [
    mode.frequencyHz,
    mode.relativeAmplitude,
    mode.decaySeconds,
    mode.q,
    mode.confidence,
    mode.diagnostics.prominenceDb,
    mode.diagnostics.persistenceSeconds,
    mode.diagnostics.frequencyStdCents,
    mode.diagnostics.decayFitScore,
    mode.diagnostics.observationCount,
  ];
}

function parseWireMode(value: unknown, sampleRate: number, durationSeconds: number): AcousticMode | undefined {
  if (!Array.isArray(value) || value.length !== 10) return undefined;
  const [
    frequencyHz,
    relativeAmplitude,
    decaySeconds,
    q,
    confidence,
    prominenceDb,
    persistenceSeconds,
    frequencyStdCents,
    decayFitScore,
    observationCount,
  ] = value;

  const maximumFrequencyHz = Math.min(MAXIMUM_MODE_FREQUENCY_HZ, sampleRate / 2);
  if (!finite(frequencyHz) || frequencyHz < MINIMUM_MODE_FREQUENCY_HZ || !(frequencyHz < maximumFrequencyHz)) return undefined;
  if (!finite(relativeAmplitude) || relativeAmplitude < MINIMUM_RELATIVE_AMPLITUDE || relativeAmplitude > 1) return undefined;
  if (!finite(decaySeconds) || !(decaySeconds > 0) || decaySeconds > 60) return undefined;
  if (!finite(q) || !(q > 0)) return undefined;
  const expectedQ = Math.PI * frequencyHz * decaySeconds;
  if (!approximatelyEqual(q, expectedQ, Q_RELATIVE_TOLERANCE)) return undefined;
  if (!finite(confidence) || confidence < MINIMUM_MODE_CONFIDENCE || confidence > 1) return undefined;
  if (!finite(prominenceDb) || prominenceDb < MINIMUM_PROMINENCE_DB || prominenceDb > 1_000) return undefined;
  if (!finite(persistenceSeconds) || persistenceSeconds < MINIMUM_TRACK_PERSISTENCE_SECONDS || persistenceSeconds > durationSeconds) return undefined;
  if (!finite(frequencyStdCents) || frequencyStdCents < 0 || frequencyStdCents > MAXIMUM_FREQUENCY_STD_CENTS) return undefined;
  if (!finite(decayFitScore) || decayFitScore < 0 || decayFitScore > 1) return undefined;
  if (!finite(observationCount) || !Number.isInteger(observationCount) || observationCount < MINIMUM_TRACK_OBSERVATIONS || observationCount > 1_000_000) return undefined;

  return {
    frequencyHz,
    relativeAmplitude,
    decaySeconds,
    q,
    confidence,
    diagnostics: {
      prominenceDb,
      persistenceSeconds,
      frequencyStdCents,
      decayFitScore,
      observationCount,
    },
  };
}

function wireCapsule(fingerprint: AcousticFingerprintV1): WireCapsuleV1 {
  return {
    v: ACOUSTIC_CAPSULE_VERSION,
    a: fingerprint.algorithmVersion,
    r: fingerprint.sampleRate,
    d: fingerprint.durationSeconds,
    s: fingerprintSignature(fingerprint),
    m: fingerprint.modes.map(wireMode),
  };
}

export function createAcousticCapsuleFragment(fingerprint: AcousticFingerprintV1): string {
  const fragment = `${ACOUSTIC_CAPSULE_FRAGMENT_PREFIX}${encodeAsciiBase64Url(JSON.stringify(wireCapsule(fingerprint)))}`;
  if (fragment.length > MAX_ACOUSTIC_CAPSULE_FRAGMENT_LENGTH) {
    throw new RangeError("Acoustic Capsule exceeds the transport size limit");
  }
  const validation = parseAcousticCapsuleHash(fragment);
  if (!validation.ok) throw new RangeError(`Fingerprint cannot be encoded as an Acoustic Capsule: ${validation.reason}`);
  return fragment;
}

export function createAcousticCapsuleUrl(fingerprint: AcousticFingerprintV1, sourceHref: string): string {
  const url = new URL(sourceHref);
  url.search = "";
  url.hash = createAcousticCapsuleFragment(fingerprint).slice(1);
  return url.toString();
}

export function isAcousticCapsuleHash(hash: string): boolean {
  return hash.startsWith(ACOUSTIC_CAPSULE_FRAGMENT_PREFIX);
}

export function parseAcousticCapsuleHash(hash: string): AcousticCapsuleParseResult {
  if (!isAcousticCapsuleHash(hash)) return { ok: false, reason: "missing" };
  if (hash.length > MAX_ACOUSTIC_CAPSULE_FRAGMENT_LENGTH) return { ok: false, reason: "too-large" };

  const encoded = hash.slice(ACOUSTIC_CAPSULE_FRAGMENT_PREFIX.length);
  const decoded = decodeAsciiBase64Url(encoded);
  if (decoded === undefined) return { ok: false, reason: "encoding" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return { ok: false, reason: "encoding" };
  }

  if (!isRecord(parsed) || !exactKeys(parsed, ["a", "d", "m", "r", "s", "v"])) {
    return { ok: false, reason: "shape" };
  }
  if (parsed.v !== ACOUSTIC_CAPSULE_VERSION) return { ok: false, reason: "unsupported-version" };
  if (!isAcousticFingerprintAlgorithmVersion(parsed.a)) return { ok: false, reason: "unsupported-algorithm" };
  if (!finite(parsed.r) || !Number.isInteger(parsed.r) || parsed.r < 8_000 || parsed.r > 384_000) {
    return { ok: false, reason: "shape" };
  }
  if (!finite(parsed.d) || !(parsed.d > 0) || parsed.d > MAX_ACOUSTIC_CAPSULE_DURATION_SECONDS) {
    return { ok: false, reason: "shape" };
  }
  if (typeof parsed.s !== "string" || !/^er1-[0-9a-f]{16}$/.test(parsed.s)) {
    return { ok: false, reason: "signature" };
  }
  if (!Array.isArray(parsed.m) || parsed.m.length === 0 || parsed.m.length > MAX_ACOUSTIC_CAPSULE_MODES) {
    return { ok: false, reason: "shape" };
  }

  const modes: AcousticMode[] = [];
  for (const candidate of parsed.m) {
    const mode = parseWireMode(candidate, parsed.r, parsed.d);
    if (mode === undefined) return { ok: false, reason: "shape" };
    modes.push(mode);
  }

  const fingerprint: AcousticFingerprintV1 = {
    version: 1,
    algorithmVersion: parsed.a,
    sampleRate: parsed.r,
    durationSeconds: parsed.d,
    modes,
  };
  const signature = fingerprintSignature(fingerprint);
  if (signature !== parsed.s) return { ok: false, reason: "signature" };
  return { ok: true, fingerprint, signature };
}
