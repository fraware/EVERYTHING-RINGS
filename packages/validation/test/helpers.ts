import type {
  GateBReview,
  GateCReview,
  MaterialClass,
  ValidationEvidenceAttempt,
  ValidationEvidenceV5,
} from "../src";
import { deriveEvidenceRecurrence, deriveMedianModalDriftCents } from "../src";

export const SOFTWARE_REVISION = "0123456789abcdef0123456789abcdef01234567";

export function fingerprint(cents = 0) {
  const ratio = 2 ** (cents / 1200);
  return {
    version: 1 as const,
    algorithmVersion: "er-dsp-1" as const,
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

export function qualifiedAttempt(
  id: number,
  cents: number,
  outcome: "success" | "failure" = "success",
): ValidationEvidenceAttempt {
  return {
    id,
    quality: {
      score: 0.95,
      snrDb: 30,
      clippedFraction: 0,
      peakAmplitude: 0.5,
      secondaryTransientRatio: 0.05,
    },
    analysis: outcome === "success"
      ? { status: "success", fingerprint: fingerprint(cents) }
      : { status: "failure", reason: "NO_STABLE_RESONANCES" },
  };
}

export function evidence(
  label: string,
  material: MaterialClass,
  options: {
    readonly comparisonCents?: readonly number[];
    readonly attemptCount?: number;
    readonly failureAttemptIds?: readonly number[];
    readonly sessionId?: string;
    readonly specimenId?: string;
    readonly softwareRevision?: string;
  } = {},
): ValidationEvidenceV5 {
  const attemptCount = options.attemptCount ?? 5;
  const comparisonCents = options.comparisonCents ?? [5, 8, 10, 12];
  const failureIds = new Set(options.failureAttemptIds ?? []);
  const attempts = Array.from({ length: attemptCount }, (_, index) => {
    const id = index + 1;
    const cents = index === 0 ? 0 : comparisonCents[index - 1] ?? 0;
    return qualifiedAttempt(id, cents, failureIds.has(id) ? "failure" : "success");
  });
  return {
    schemaVersion: 5,
    evidenceContractVersion: "validation-evidence-5",
    gateAContractVersion: "gate-a-2",
    sessionId: options.sessionId ?? `session-${label}`,
    createdAt: "2026-08-15T12:00:00.000Z",
    softwareRevision: options.softwareRevision ?? SOFTWARE_REVISION,
    object: { specimenId: options.specimenId ?? label, label, material },
    protocol: {
      fixedSetup: true,
      microphoneDistanceCm: 20,
      striker: "wooden dowel",
      strikeLocation: "rim mark",
      supportCondition: "held at base",
    },
    captureSettings: null,
    realtimeAudioTiming: null,
    attemptCount,
    medianModalDriftCents: deriveMedianModalDriftCents(attempts),
    recurrence: deriveEvidenceRecurrence(attempts),
    attempts,
    gateBReviews: [],
    gateCReviews: [],
    rawMicrophoneSamplesIncluded: false,
  };
}

export function fiveObjects(): ValidationEvidenceV5[] {
  return [
    evidence("bell", "metal", { specimenId: "specimen-bell" }),
    evidence("wine glass", "glass", { specimenId: "specimen-wine-glass" }),
    evidence("metal bowl", "metal", { specimenId: "specimen-metal-bowl" }),
    evidence("glass bottle", "glass", { specimenId: "specimen-glass-bottle" }),
    evidence("ceramic mug", "ceramic", { specimenId: "specimen-ceramic-mug" }),
  ];
}

export function targetFor(objectLabel: string, sessionId = `session-${objectLabel}`) {
  return { sessionId, attemptId: 5 } as const;
}

export function gateBReview(
  objectLabel: string,
  reviewerId: string,
  overrides: Partial<GateBReview> = {},
): GateBReview {
  return {
    reviewId: `${objectLabel}-${reviewerId}-${overrides.sessionId ?? "default"}`,
    reviewerId,
    objectLabel,
    ...targetFor(objectLabel),
    blinded: true,
    presentationOrder: "original-model",
    identity: 4,
    brightness: 4,
    decayCharacter: 4,
    artifactSeverity: 2,
    ...overrides,
  };
}

export function gateCReview(
  objectLabel: string,
  deviceId: string,
  deviceClass: "desktop" | "mobile",
  overrides: Partial<GateCReview> = {},
): GateCReview {
  return {
    reviewId: `${objectLabel}-${deviceId}-${overrides.reviewerId ?? "listener-1"}-${overrides.sessionId ?? "default"}`,
    reviewerId: "listener-1",
    objectLabel,
    ...targetFor(objectLabel),
    deviceId,
    deviceClass,
    identityAcrossRange: 4,
    timbreContinuity: 4,
    usefulSemitoneSpan: 12,
    latencyAcceptable: true,
    ...overrides,
  };
}
