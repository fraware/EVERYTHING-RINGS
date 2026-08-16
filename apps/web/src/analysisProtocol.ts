import type { AcousticFingerprintV1 } from "@everything-rings/dsp";

export interface AnalysisWorkerTiming {
  readonly ringdownMs: number;
  readonly modalAnalysisMs: number;
  readonly totalMs: number;
}

export type AnalysisRequest = {
  readonly type: "ANALYZE";
  readonly requestId: string;
  readonly samples: Float32Array;
  readonly sampleRate: number;
};

export type AnalysisResponse =
  | {
      readonly type: "SUCCESS";
      readonly requestId: string;
      readonly fingerprint: AcousticFingerprintV1;
      readonly timing: AnalysisWorkerTiming;
    }
  | {
      readonly type: "FAILURE";
      readonly requestId: string;
      readonly reason: string;
      readonly timing: AnalysisWorkerTiming;
    };
