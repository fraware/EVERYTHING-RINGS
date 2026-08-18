import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { describe, expect, it } from "vitest";
import {
  ACOUSTIC_CAPSULE_FRAGMENT_PREFIX,
  MAX_ACOUSTIC_CAPSULE_DURATION_SECONDS,
  MAX_ACOUSTIC_CAPSULE_FRAGMENT_LENGTH,
  createAcousticCapsuleFragment,
  createAcousticCapsuleUrl,
  parseAcousticCapsuleHash,
} from "./acousticCapsule";

const fingerprint: AcousticFingerprintV1 = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48_000,
  durationSeconds: 3.2,
  modes: [
    {
      frequencyHz: 440.25,
      relativeAmplitude: 1,
      decaySeconds: 1.21,
      q: Math.PI * 440.25 * 1.21,
      confidence: 0.94,
      diagnostics: {
        prominenceDb: 19.4,
        persistenceSeconds: 1.08,
        frequencyStdCents: 3.8,
        decayFitScore: 0.92,
        observationCount: 18,
      },
    },
    {
      frequencyHz: 997.4,
      relativeAmplitude: 0.61,
      decaySeconds: 0.72,
      q: Math.PI * 997.4 * 0.72,
      confidence: 0.88,
      diagnostics: {
        prominenceDb: 14.2,
        persistenceSeconds: 0.68,
        frequencyStdCents: 6.1,
        decayFitScore: 0.86,
        observationCount: 13,
      },
    },
    {
      frequencyHz: 2413.2,
      relativeAmplitude: 0.34,
      decaySeconds: 0.39,
      q: Math.PI * 2413.2 * 0.39,
      confidence: 0.81,
      diagnostics: {
        prominenceDb: 10.8,
        persistenceSeconds: 0.36,
        frequencyStdCents: 8.9,
        decayFitScore: 0.79,
        observationCount: 9,
      },
    },
  ],
};

describe("Acoustic Capsule transport", () => {
  it("round-trips one fingerprint exactly through a bounded fragment", () => {
    const fragment = createAcousticCapsuleFragment(fingerprint);
    expect(fragment.startsWith(ACOUSTIC_CAPSULE_FRAGMENT_PREFIX)).toBe(true);
    expect(fragment.length).toBeLessThan(MAX_ACOUSTIC_CAPSULE_FRAGMENT_LENGTH);
    const parsed = parseAcousticCapsuleHash(fragment);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.fingerprint).toEqual(fingerprint);
    expect(parsed.signature).toMatch(/^er1-[0-9a-f]{16}$/);
  });

  it("places transport data in the fragment and strips creator route state", () => {
    const url = new URL(createAcousticCapsuleUrl(
      fingerprint,
      "https://example.test/EVERYTHING-RINGS/?lab=1#old",
    ));
    expect(url.pathname).toBe("/EVERYTHING-RINGS/");
    expect(url.search).toBe("");
    expect(url.hash.startsWith(ACOUSTIC_CAPSULE_FRAGMENT_PREFIX)).toBe(true);
  });

  it("fails closed on missing, malformed, corrupted, and oversized fragments", () => {
    expect(parseAcousticCapsuleHash("")).toEqual({ ok: false, reason: "missing" });
    expect(parseAcousticCapsuleHash("#ring=%%%" )).toEqual({ ok: false, reason: "encoding" });
    const valid = createAcousticCapsuleFragment(fingerprint);
    const corrupted = `${valid.slice(0, -1)}${valid.endsWith("A") ? "B" : "A"}`;
    expect(parseAcousticCapsuleHash(corrupted).ok).toBe(false);
    expect(parseAcousticCapsuleHash(`#ring=${"A".repeat(MAX_ACOUSTIC_CAPSULE_FRAGMENT_LENGTH)}`))
      .toEqual({ ok: false, reason: "too-large" });
  });

  it("refuses to create links from unsupported fingerprint algorithms", () => {
    const unsupported = {
      ...fingerprint,
      algorithmVersion: "er-dsp-future",
    } as unknown as AcousticFingerprintV1;
    expect(() => createAcousticCapsuleFragment(unsupported)).toThrow(/unsupported-algorithm/);
  });

  it("refuses empty or over-capacity mode sets at creation and parsing", () => {
    expect(() => createAcousticCapsuleFragment({ ...fingerprint, modes: [] })).toThrow(/shape/);
    const modes = Array.from({ length: 17 }, (_, index) => {
      const frequencyHz = 200 + index * 100;
      const decaySeconds = fingerprint.modes[0]!.decaySeconds;
      return {
        ...fingerprint.modes[0]!,
        frequencyHz,
        q: Math.PI * frequencyHz * decaySeconds,
      };
    });
    expect(() => createAcousticCapsuleFragment({ ...fingerprint, modes })).toThrow(/shape/);
  });

  it("rejects consumer payloads that exceed the bounded render duration", () => {
    expect(() => createAcousticCapsuleFragment({
      ...fingerprint,
      durationSeconds: MAX_ACOUSTIC_CAPSULE_DURATION_SECONDS + 0.001,
    })).toThrow(/shape/);
  });

  it("rejects internally contradictory canonical mode quantities", () => {
    const inconsistentQ = {
      ...fingerprint,
      modes: [{ ...fingerprint.modes[0]!, q: fingerprint.modes[0]!.q * 1.01 }, ...fingerprint.modes.slice(1)],
    };
    expect(() => createAcousticCapsuleFragment(inconsistentQ)).toThrow(/shape/);

    const unstableTrack = {
      ...fingerprint,
      modes: [{
        ...fingerprint.modes[0]!,
        diagnostics: { ...fingerprint.modes[0]!.diagnostics, observationCount: 7 },
      }, ...fingerprint.modes.slice(1)],
    };
    expect(() => createAcousticCapsuleFragment(unstableTrack)).toThrow(/shape/);
  });

  it("never reconstructs a microphone-sample field", () => {
    const fragment = createAcousticCapsuleFragment(fingerprint);
    const parsed = parseAcousticCapsuleHash(fragment);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect("samples" in parsed.fingerprint).toBe(false);
    expect(JSON.stringify(parsed.fingerprint)).not.toContain('"samples"');
  });
});
