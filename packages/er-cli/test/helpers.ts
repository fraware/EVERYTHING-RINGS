import {
  deriveEvidenceRecurrence,
  deriveMedianModalDriftCents,
  type ValidationEvidenceAttempt,
  type ValidationEvidenceV5,
} from "@everything-rings/validation";

export const SOFTWARE_REVISION = "0123456789abcdef0123456789abcdef01234567";

export function fingerprint(cents = 0) {
  const ratio = 2 ** (cents / 1200);
  return {
    version: 1 as const,
    algorithmVersion: "er-dsp-2" as const,
    sampleRate: 48000,
    durationSeconds: 2,
    modes: [440, 880, 1320].map((frequencyHz, index) => ({
      frequencyHz: frequencyHz * ratio,
      relativeAmplitude: 1 / (index + 1),
      decaySeconds: 0.4 / (index + 1),
      q: 100,
      confidence: 0.9,
      diagnostics: {
        prominenceDb: 20,
        persistenceSeconds: 0.2,
        frequencyStdCents: 2,
        decayFitScore: 0.95,
        observationCount: 12,
      },
    })),
  };
}

function qualifiedAttempt(id: number, cents: number): ValidationEvidenceAttempt {
  return {
    id,
    quality: {
      score: 0.95,
      snrDb: 30,
      clippedFraction: 0,
      peakAmplitude: 0.5,
      secondaryTransientRatio: 0.05,
    },
    analysis: { status: "success", fingerprint: fingerprint(cents) },
  };
}

export function validEvidence(): ValidationEvidenceV5 {
  const attempts = [0, 5, 8, 10, 12].map((cents, index) => qualifiedAttempt(index + 1, cents));
  return {
    schemaVersion: 5,
    evidenceContractVersion: "validation-evidence-5",
    gateAContractVersion: "gate-a-2",
    sessionId: "session-cli-fixture",
    createdAt: "2026-08-15T12:00:00.000Z",
    softwareRevision: SOFTWARE_REVISION,
    object: { specimenId: "specimen-cli", label: "cli fixture", material: "metal" },
    protocol: {
      fixedSetup: true,
      microphoneDistanceCm: 20,
      striker: "wooden dowel",
      strikeLocation: "rim mark",
      supportCondition: "held at base",
    },
    captureSettings: null,
    realtimeAudioTiming: null,
    attemptCount: attempts.length,
    medianModalDriftCents: deriveMedianModalDriftCents(attempts),
    recurrence: deriveEvidenceRecurrence(attempts),
    attempts,
    gateBReviews: [],
    gateCReviews: [],
    rawMicrophoneSamplesIncluded: false,
  };
}

export function captureIo() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout: { write(data: string) { stdout += data; } },
      stderr: { write(data: string) { stderr += data; } },
    },
    stdout() { return stdout; },
    stderr() { return stderr; },
    json(): Record<string, unknown> {
      return JSON.parse(stdout) as Record<string, unknown>;
    },
  };
}
