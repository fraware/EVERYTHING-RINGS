import {
  analyzeImpact,
  extractImpactRingdown,
} from "@everything-rings/dsp";
import { DEFAULT_CAPTURE_CONFIG } from "@everything-rings/acquisition";
import type { AnalysisRequest, AnalysisResponse, AnalysisWorkerTiming } from "./analysisProtocol";

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<AnalysisRequest>) => void) | null;
  postMessage(message: AnalysisResponse): void;
};

scope.onmessage = (event) => {
  if (event.data.type !== "ANALYZE") return;
  const startedAt = performance.now();
  const coarseOnsetSample = Math.round((DEFAULT_CAPTURE_CONFIG.preTriggerMs / 1000) * event.data.sampleRate);
  const ringdown = extractImpactRingdown(event.data.samples, event.data.sampleRate, coarseOnsetSample);
  const ringdownFinishedAt = performance.now();
  const result = analyzeImpact(ringdown.samples, event.data.sampleRate);
  const analysisFinishedAt = performance.now();
  const timing: AnalysisWorkerTiming = {
    ringdownMs: ringdownFinishedAt - startedAt,
    modalAnalysisMs: analysisFinishedAt - ringdownFinishedAt,
    totalMs: analysisFinishedAt - startedAt,
  };
  const response: AnalysisResponse = result.ok
    ? {
        type: "SUCCESS",
        requestId: event.data.requestId,
        fingerprint: result.fingerprint,
        timing,
      }
    : {
        type: "FAILURE",
        requestId: event.data.requestId,
        reason: result.reason,
        timing,
      };
  scope.postMessage(response);
};
