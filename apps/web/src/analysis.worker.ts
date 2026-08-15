import {
  analyzeImpact,
  extractImpactRingdown,
  type AcousticFingerprintV1,
} from "@everything-rings/dsp";
import { DEFAULT_CAPTURE_CONFIG } from "@everything-rings/acquisition";

type AnalysisRequest = {
  readonly type: "ANALYZE";
  readonly requestId: string;
  readonly samples: Float32Array;
  readonly sampleRate: number;
};

type AnalysisResponse =
  | {
      readonly type: "SUCCESS";
      readonly requestId: string;
      readonly fingerprint: AcousticFingerprintV1;
    }
  | {
      readonly type: "FAILURE";
      readonly requestId: string;
      readonly reason: string;
    };

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<AnalysisRequest>) => void) | null;
  postMessage(message: AnalysisResponse): void;
};

scope.onmessage = (event) => {
  if (event.data.type !== "ANALYZE") return;
  const coarseOnsetSample = Math.round((DEFAULT_CAPTURE_CONFIG.preTriggerMs / 1000) * event.data.sampleRate);
  const ringdown = extractImpactRingdown(event.data.samples, event.data.sampleRate, coarseOnsetSample);
  const result = analyzeImpact(ringdown.samples, event.data.sampleRate);
  const response: AnalysisResponse = result.ok
    ? {
        type: "SUCCESS",
        requestId: event.data.requestId,
        fingerprint: result.fingerprint,
      }
    : {
        type: "FAILURE",
        requestId: event.data.requestId,
        reason: result.reason,
      };
  scope.postMessage(response);
};
