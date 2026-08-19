import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import type { ValidationEvidenceV5 } from "@everything-rings/validation";
import { describe, expect, it } from "vitest";
import {
  createGateBListeningCompanion,
  parseGateBListeningCompanionJson,
  validateGateBListeningCompanionBinding,
} from "./gateBListeningCompanion";

const FINGERPRINT: AcousticFingerprintV1 = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48_000,
  durationSeconds: 1.2,
  modes: [
    { frequencyHz: 440, relativeAmplitude: 1, decaySeconds: 0.8, q: 1105, confidence: 0.96, diagnostics: { prominenceDb: 24, persistenceSeconds: 0.7, frequencyStdCents: 2, decayFitScore: 0.95, observationCount: 18 } },
    { frequencyHz: 880, relativeAmplitude: 0.6, decaySeconds: 0.6, q: 1650, confidence: 0.93, diagnostics: { prominenceDb: 21, persistenceSeconds: 0.5, frequencyStdCents: 2, decayFitScore: 0.93, observationCount: 16 } },
    { frequencyHz: 1320, relativeAmplitude: 0.4, decaySeconds: 0.45, q: 1860, confidence: 0.9, diagnostics: { prominenceDb: 18, persistenceSeconds: 0.4, frequencyStdCents: 3, decayFitScore: 0.9, observationCount: 14 } },
  ],
};

function evidence(): ValidationEvidenceV5 {
  return {
    schemaVersion: 5,
    evidenceContractVersion: "validation-evidence-5",
    gateAContractVersion: "gate-a-2",
    sessionId: "session-01",
    createdAt: "2026-08-19T00:00:00.000Z",
    softwareRevision: "a".repeat(40),
    object: { specimenId: "core-metal-1--inv-003", label: "metal bowl", material: "metal" },
    protocol: {
      fixedSetup: true,
      microphoneDistanceCm: 20,
      striker: "wooden dowel",
      strikeLocation: "rim mark A",
      supportCondition: "three felt points",
    },
    captureSettings: { sampleRate: 48_000 },
    realtimeAudioTiming: null,
    attemptCount: 5,
    medianModalDriftCents: 0,
    recurrence: [],
    attempts: Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      quality: {
        score: 1,
        snrDb: 30,
        clippedFraction: 0,
        peakAmplitude: 0.2,
        secondaryTransientRatio: 0.1,
      },
      analysis: { status: "success" as const, fingerprint: FINGERPRINT },
    })),
    gateBReviews: [],
    gateCReviews: [],
    rawMicrophoneSamplesIncluded: false,
  };
}

describe("Gate B listening companion", () => {
  it("round-trips exact float32 samples and binds the selected attempt", async () => {
    const samples = new Float32Array([0, 0.125, -0.25, 0.5, -0.75]);
    const source = evidence();
    const companion = await createGateBListeningCompanion(
      source,
      samples,
      48_000,
      FINGERPRINT,
      "2026-08-19T01:00:00.000Z",
    );

    expect(companion.attemptId).toBe(5);
    expect(companion.sessionId).toBe(source.sessionId);
    expect(companion.containsLocalMicrophoneSamples).toBe(true);

    const parsed = await parseGateBListeningCompanionJson(JSON.stringify(companion));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(Array.from(parsed.samples)).toEqual(Array.from(samples));

    const binding = await validateGateBListeningCompanionBinding(parsed.companion, source);
    expect(binding.ok).toBe(true);
    if (binding.ok) expect(binding.fingerprint).toEqual(FINGERPRINT);
  });

  it("rejects an audio payload changed without its SHA-256", async () => {
    const companion = await createGateBListeningCompanion(
      evidence(),
      new Float32Array([0.1, 0.2, 0.3]),
      48_000,
      FINGERPRINT,
      "2026-08-19T01:00:00.000Z",
    );
    const payload = companion.audioPayloadBase64;
    const replacement = payload.endsWith("A") ? "B" : "A";
    const parsed = await parseGateBListeningCompanionJson(JSON.stringify({
      ...companion,
      audioPayloadBase64: `${payload.slice(0, -1)}${replacement}`,
    }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/SHA-256|base64|byte length/);
  });

  it("rejects a companion bound to another evidence session", async () => {
    const source = evidence();
    const companion = await createGateBListeningCompanion(
      source,
      new Float32Array([0.1, 0.2, 0.3]),
      48_000,
      FINGERPRINT,
      "2026-08-19T01:00:00.000Z",
    );
    const other = { ...source, sessionId: "session-02" };
    const binding = await validateGateBListeningCompanionBinding(companion, other);
    expect(binding.ok).toBe(false);
    if (!binding.ok) expect(binding.error).toContain("session ID mismatch");
  });

  it("refuses export when the live fingerprint is not the selected attempt fingerprint", async () => {
    const changed = {
      ...FINGERPRINT,
      modes: FINGERPRINT.modes.map((mode, index) => index === 0 ? { ...mode, frequencyHz: 445 } : mode),
    };
    await expect(createGateBListeningCompanion(
      evidence(),
      new Float32Array([0.1, 0.2, 0.3]),
      48_000,
      changed,
      "2026-08-19T01:00:00.000Z",
    )).rejects.toThrow("current fingerprint does not match");
  });
});
