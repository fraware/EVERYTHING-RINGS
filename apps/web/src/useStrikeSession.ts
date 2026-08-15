import {
  assessCaptureQuality,
  createCaptureGraph,
  openMicrophone,
  type AudioCapture,
  type CaptureGraph,
  type CaptureQuality,
  type CaptureSettingsSnapshot,
  type CaptureWorkletEvent,
  type OpenedMicrophone,
} from "@everything-rings/acquisition";
import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { useEffect, useRef, useState } from "react";
import captureWorkletUrl from "../../../packages/acquisition/src/worklet/capture-processor.ts?worker&url";

export type StrikeSessionState =
  | "idle"
  | "warming"
  | "armed"
  | "capturing"
  | "analyzing"
  | "success"
  | "failure"
  | "error";

export interface StrikeRecord {
  readonly id: number;
  readonly fingerprint: AcousticFingerprintV1;
  readonly quality: CaptureQuality;
}

interface SessionResources {
  context: AudioContext;
  microphone: OpenedMicrophone;
  graph: CaptureGraph;
  worker: Worker;
}

type AnalysisResponse =
  | { readonly type: "SUCCESS"; readonly requestId: string; readonly fingerprint: AcousticFingerprintV1 }
  | { readonly type: "FAILURE"; readonly requestId: string; readonly reason: string };

const EMPTY_QUALITY: CaptureQuality = {
  score: 0,
  snrDb: 0,
  clippedFraction: 0,
  peakAmplitude: 0,
  secondaryTransientRatio: 0,
};

function playSamples(context: AudioContext, samples: Float32Array, sampleRate: number): void {
  const buffer = context.createBuffer(1, samples.length, sampleRate);
  const copy = new Float32Array(samples.length);
  copy.set(samples);
  buffer.copyToChannel(copy, 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
}

export function useStrikeSession() {
  const [state, setState] = useState<StrikeSessionState>("idle");
  const [settings, setSettings] = useState<CaptureSettingsSnapshot>();
  const [capture, setCapture] = useState<AudioCapture>();
  const [quality, setQuality] = useState<CaptureQuality>();
  const [fingerprint, setFingerprint] = useState<AcousticFingerprintV1>();
  const [failureReason, setFailureReason] = useState<string>();
  const [records, setRecords] = useState<StrikeRecord[]>([]);
  const resources = useRef<SessionResources | undefined>(undefined);
  const requestId = useRef(0);
  const pendingQuality = useRef<CaptureQuality | undefined>(undefined);

  function disposeResources(): void {
    const current = resources.current;
    if (current === undefined) return;
    current.graph.disconnect();
    current.microphone.stream.getTracks().forEach((track) => track.stop());
    current.worker.terminate();
    void current.context.close();
    resources.current = undefined;
  }

  async function start(): Promise<void> {
    let openingMicrophone: OpenedMicrophone | undefined;
    let openingContext: AudioContext | undefined;
    let openingGraph: CaptureGraph | undefined;
    let openingWorker: Worker | undefined;

    try {
      disposeResources();
      setFailureReason(undefined);
      setFingerprint(undefined);
      setCapture(undefined);
      setQuality(undefined);
      setRecords([]);
      pendingQuality.current = undefined;
      setState("warming");

      openingMicrophone = await openMicrophone();
      openingContext = new AudioContext();
      await openingContext.resume();
      openingGraph = await createCaptureGraph(openingContext, openingMicrophone.stream, captureWorkletUrl);
      openingWorker = new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" });

      const microphone = openingMicrophone;
      const context = openingContext;
      const graph = openingGraph;
      const worker = openingWorker;
      resources.current = { context, microphone, graph, worker };
      setSettings(microphone.settings);

      graph.node.port.onmessage = (event: MessageEvent<CaptureWorkletEvent>) => {
        if (event.data.type === "STATE") {
          if (event.data.state === "warming") setState("warming");
          if (event.data.state === "armed") setState("armed");
          if (event.data.state === "capturing") setState("capturing");
          return;
        }

        const nextCapture = event.data.capture;
        setCapture(nextCapture);
        const assessment = assessCaptureQuality(nextCapture);
        setQuality(assessment.quality);
        pendingQuality.current = assessment.quality;
        if (!assessment.ok) {
          setFailureReason(assessment.reason);
          setState("failure");
          return;
        }

        setState("analyzing");
        requestId.current += 1;
        const id = String(requestId.current);
        const samples = nextCapture.samples.slice();
        worker.postMessage(
          { type: "ANALYZE", requestId: id, samples, sampleRate: nextCapture.sampleRate },
          [samples.buffer],
        );
      };

      worker.onmessage = (event: MessageEvent<AnalysisResponse>) => {
        if (event.data.requestId !== String(requestId.current)) return;
        if (event.data.type === "FAILURE") {
          setFailureReason(event.data.reason);
          setState("failure");
          return;
        }

        const nextFingerprint = event.data.fingerprint;
        setFingerprint(nextFingerprint);
        setRecords((current) => [
          ...current,
          {
            id: current.length + 1,
            fingerprint: nextFingerprint,
            quality: pendingQuality.current ?? EMPTY_QUALITY,
          },
        ]);
        setState("success");
      };

      worker.onerror = (event) => {
        setFailureReason(event.message || "Analysis worker failed");
        setState("error");
      };
    } catch (error) {
      if (resources.current === undefined) {
        openingGraph?.disconnect();
        openingWorker?.terminate();
        openingMicrophone?.stream.getTracks().forEach((track) => track.stop());
        if (openingContext !== undefined) void openingContext.close();
      }
      setFailureReason(error instanceof Error ? error.message : String(error));
      setState("error");
    }
  }

  function reset(): void {
    setFailureReason(undefined);
    setFingerprint(undefined);
    setCapture(undefined);
    setQuality(undefined);
    pendingQuality.current = undefined;
    const node = resources.current?.graph.node;
    if (node === undefined) {
      setState("idle");
      return;
    }
    node.port.postMessage({ type: "RESET" });
    setState("warming");
  }

  function stop(): void {
    disposeResources();
    setState("idle");
  }

  function play(samples: Float32Array, sampleRate: number): void {
    const context = resources.current?.context;
    if (context === undefined) return;
    playSamples(context, samples, sampleRate);
  }

  function playbackSampleRate(): number | undefined {
    return resources.current?.context.sampleRate;
  }

  useEffect(() => () => disposeResources(), []);

  return {
    state,
    settings,
    capture,
    quality,
    fingerprint,
    failureReason,
    records,
    start,
    reset,
    stop,
    play,
    playbackSampleRate,
  } as const;
}
