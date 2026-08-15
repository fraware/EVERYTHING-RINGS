import type { CaptureQuality } from "@everything-rings/acquisition";
import type { ValidationAttemptAnalysis } from "@everything-rings/validation";

export interface QualifiedAttempt {
  readonly id: number;
  readonly quality: CaptureQuality;
  readonly analysis: ValidationAttemptAnalysis;
}

export interface PendingQualifiedAttempt {
  readonly requestId: string;
  readonly quality: CaptureQuality;
}

export interface QualifiedAttemptLedger {
  readonly attempts: readonly QualifiedAttempt[];
  readonly pending?: PendingQualifiedAttempt;
}

export interface QualifiedAttemptSettlement {
  readonly ledger: QualifiedAttemptLedger;
  readonly settled: boolean;
}

export function createQualifiedAttemptLedger(): QualifiedAttemptLedger {
  return { attempts: [] };
}

export function beginQualifiedAttempt(
  ledger: QualifiedAttemptLedger,
  requestId: string,
  quality: CaptureQuality,
  maximumAttempts?: number,
): QualifiedAttemptLedger {
  if (requestId.length === 0) throw new RangeError("Qualified attempt request ID must be non-empty");
  if (ledger.pending !== undefined) throw new Error("A qualified attempt is already awaiting analysis");
  if (maximumAttempts !== undefined && ledger.attempts.length >= maximumAttempts) {
    throw new Error(`Qualified attempt limit of ${maximumAttempts} has been reached`);
  }
  return { attempts: ledger.attempts, pending: { requestId, quality } };
}

export function settleQualifiedAttempt(
  ledger: QualifiedAttemptLedger,
  requestId: string,
  analysis: ValidationAttemptAnalysis,
): QualifiedAttemptSettlement {
  const pending = ledger.pending;
  if (pending === undefined || pending.requestId !== requestId) {
    return { ledger, settled: false };
  }
  const attempt: QualifiedAttempt = {
    id: ledger.attempts.length + 1,
    quality: pending.quality,
    analysis,
  };
  return {
    settled: true,
    ledger: { attempts: [...ledger.attempts, attempt] },
  };
}

export function interruptQualifiedAttempt(
  ledger: QualifiedAttemptLedger,
): QualifiedAttemptSettlement {
  const pending = ledger.pending;
  if (pending === undefined) return { ledger, settled: false };
  return settleQualifiedAttempt(
    ledger,
    pending.requestId,
    { status: "failure", reason: "ANALYSIS_INTERNAL_ERROR" },
  );
}

export function clearQualifiedAttemptLedger(): QualifiedAttemptLedger {
  return createQualifiedAttemptLedger();
}
