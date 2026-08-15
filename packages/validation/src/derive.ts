import { fingerprintRecurrence } from "@everything-rings/fingerprint";
import type { EvidenceRecurrence, ValidationEvidenceRecord } from "./types";

export function deriveEvidenceRecurrence(
  records: readonly ValidationEvidenceRecord[],
): readonly EvidenceRecurrence[] {
  const reference = records[0]?.fingerprint;
  if (reference === undefined) return [];
  return records.slice(1).map((record) => ({
    recordId: record.id,
    ...fingerprintRecurrence(reference, record.fingerprint),
  }));
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
  records: readonly ValidationEvidenceRecord[],
): number | null {
  return medianFinite(deriveEvidenceRecurrence(records).map((comparison) => comparison.medianCents));
}
