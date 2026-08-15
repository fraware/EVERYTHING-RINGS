import { fingerprintRecurrence } from "@everything-rings/fingerprint";
import type { EvidenceRecurrence, ValidationEvidenceAttempt } from "./types";

export function successfulFingerprint(
  attempt: ValidationEvidenceAttempt | undefined,
) {
  return attempt?.analysis.status === "success" ? attempt.analysis.fingerprint : undefined;
}

export function deriveEvidenceRecurrence(
  attempts: readonly ValidationEvidenceAttempt[],
): readonly EvidenceRecurrence[] {
  const reference = successfulFingerprint(attempts[0]);
  if (reference === undefined) return [];
  const recurrence: EvidenceRecurrence[] = [];
  for (const attempt of attempts.slice(1)) {
    const fingerprint = successfulFingerprint(attempt);
    if (fingerprint === undefined) continue;
    recurrence.push({
      attemptId: attempt.id,
      ...fingerprintRecurrence(reference, fingerprint),
    });
  }
  return recurrence;
}

export function medianFinite(values: readonly number[]): number | null {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finite.length === 0) return null;
  const middle = Math.floor(finite.length / 2);
  const upper = finite[middle];
  if (upper === undefined) return null;
  if (finite.length % 2 === 1) return upper;
  return ((finite[middle - 1] ?? upper) + upper) / 2;
}

export function deriveMedianModalDriftCents(
  attempts: readonly ValidationEvidenceAttempt[],
): number | null {
  return medianFinite(deriveEvidenceRecurrence(attempts).map((comparison) => comparison.medianCents));
}
