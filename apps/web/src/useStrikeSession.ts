import type { AnalysisFailureReasonEvidence } from "@everything-rings/validation";
import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import type {
  ModalInstrumentWorkletEvent,
  ModalInstrumentWorkletMessage,
} from "@everything-rings/instrument";
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
import { useEffect, useRef, useState } from "react";
import captureWorkletUrl from "../../../packages/acquisition/src/worklet/capture-processor.ts?worker&url";
import { SamplePlaybackController } from "./audioPlayback";
import instrumentWorkletUrl from "./instrument-processor.ts?worker&url";
import {
  beginQualifiedAttempt,
  clearQualifiedAttemptLedger,
  createQualifiedAttemptLedger,
  interruptQualifiedAttempt,
  settleQualifiedAttempt,
  type QualifiedAttempt,
  type QualifiedAttemptLedger,
} from "./qualifiedAttemptLedger";
import { microphoneStartFailureCopy, playbackFailureCopy } from "./sessionErrors";

export type StrikeSessionState =
  | "idle"
  | "warming"
  | "armed"
  | "capturing"
  | "analyzing"
  | "success"
  | "failure"
  | "error";

export type StrikeAttempt = QualifiedAttempt;

export interface RealtimeAudioTiming {
  readonly baseLatencyMs: number;
  readonly outputLatencyMs?: number;
  readonly renderQuantumMs: number;
  readonly lastSchedulingMs?: number;
}

export interface StrikeSessionOptions {
  readonly maximumQualifiedAttempts?: number;
}

interface SessionResources {
  context: AudioContext;
  microphone: OpenedMicrophone;
  graph: CaptureGraph;
  worker: Worker;
  playback: SamplePlaybackController;
  instrument?: AudioWorkletNode;
}

type AnalysisResponse =
  | { readonly type: "SUCCESS"; readonly requestId: string; readonly fingerprint: AcousticFingerprintV1 }
  | { readonly type: "FAILURE"; readonly requestId: string; readonly reason: AnalysisFailureReasonEvidence };

function initialAudioTiming(context: AudioContext): RealtimeAudioTiming {
  const outputLatency = (context as AudioContext & { readonly outputLatency?: number }).outputLatency;
  const timing: RealtimeAudioTiming = {
    baseLatencyMs: context.baseLatency * 1000,
    renderQuantumMs: 128 / context.sampleRate * 1000,
  };
  if (typeof outputLatency === "number" && Number.isFinite(outputLatency)) {
    return { ...timing, outputLatencyMs: outputLatency * 1000 };
  }
  return timing;
}

export function useStrikeSession(options: StrikeSessionOptions = {}) {
  const [state, setState] = useState<StrikeSessionState>("idle");
  const [settings, setSettings] = useState<CaptureSettingsSnapshot>();
  const [capture, setCapture] = useState<AudioCapture>();
  const [quality, setQuality] = useState<CaptureQuality>();
  const [fingerprint, setFingerprint] = useState<AcousticFingerprintV1>();
  const [failureReason, setFailureReason] = useState<string>();
  const [attempts, setAttempts] = useState<QualifiedAttempt[]>([]);
  const [instrumentReady, setInstrumentReady] = useState(false);
  const [instrumentFailure, setInstrumentFailure] = useState<string>();
  const [playbackFailure, setPlaybackFailure] = useState<string>();
  const [audioTiming, setAudioTiming] = useState<RealtimeAudioTiming>();
  const resources = useRef<SessionResources | undefined>(undefined);
  const requestId = useRef(0);
  const attemptLedger = useRef<QualifiedAttemptLedger>(createQualifiedAttemptLedger());
  const instrumentPreparation = useRef<Promise<void> | undefined>(undefined);
  const instrumentGeneration = useRef(0);
  const nextInstrumentEventId = useRef(1);
  const pendingInstrumentEvents = useRef(new Map<number, number>());
  const maximumQualifiedAttempts = options.maximumQualifiedAttempts;

  function syncLedger(next: QualifiedAttemptLedger): void {
    attemptLedger.current = next;
    setAttempts([...next.attempts]);
  }

  function settleCurrentAttempt(
    request: string,
    analysis: QualifiedAttempt["analysis"],
  ): boolean {
    const settlement = settleQualifiedAttempt(attemptLedger.current, request, analysis);
    if (!settlement.settled) return false;
    syncLedger(settlement.ledger);
    return true;
  }

  function retainInterruptedQualifiedAttempt(): boolean {
    const settlement = interruptQualifiedAttempt(attemptLedger.current);
    if (!settlement.settled) return false;
    syncLedger(settlement.ledger);
    requestId.current += 1;
    return true;
  }

  function postInstrument(message: ModalInstrumentWorkletMessage): boolean {
    const node = resources.current?.instrument;
    if (node === undefined) return false;
    node.port.postMessage(message);
    return true;
  }

  function silenceAudio(): void {
    resources.current?.playback.stop();
    pendingInstrumentEvents.current.clear();
    postInstrument({ type: "ALL_NOTES_OFF" });
  }

  async function ensureInstrument(): Promise<AudioWorkletNode | undefined> {
    const current = resources.current;
    if (current === undefined) return undefined;
    if (current.instrument !== undefined) return current.instrument;

    if (instrumentPreparation.current === undefined) {
      const context = current.context;
      const preparation = (async () => {
        await context.audioWorklet.addModule(instrumentWorkletUrl);
        if (resources.current !== current || current.instrument !== undefined) return;
        const node = new AudioWorkletNode(context, "everything-rings-instrument", {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        });
        node.port.onmessage = (event: MessageEvent<ModalInstrumentWorkletEvent>) => {
          if (event.data.type !== "NOTE_STARTED") return;
          const sentContextTime = pendingInstrumentEvents.current.get(event.data.eventId);
          if (sentContextTime === undefined) return;
          pendingInstrumentEvents.current.delete(event.data.eventId);
          const scheduledContextTime = event.data.frame / context.sampleRate;
          const schedulingMs = Math.max(0, (scheduledContextTime - sentContextTime) * 1000);
          setAudioTiming((value) => value === undefined ? value : { ...value, lastSchedulingMs: schedulingMs });
        };
        node.connect(context.destination);
        current.instrument = node;
      })();
      instrumentPreparation.current = preparation;
      try {
        await preparation;
      } finally {
        if (instrumentPreparation.current === preparation) instrumentPreparation.current = undefined;
      }
    } else {
      await instrumentPreparation.current;
    }

    return resources.current === current ? current.instrument : undefined;
  }

  async function prepareInstrument(nextFingerprint: AcousticFingerprintV1): Promise<void> {
    const generation = instrumentGeneration.current;
    setInstrumentReady(false);
    setInstrumentFailure(undefined);
    try {
      const node = await ensureInstrument();
      if (node === undefined || generation !== instrumentGeneration.current) return;
      const message: ModalInstrumentWorkletMessage = {
        type: "SET_FINGERPRINT",
        fingerprint: nextFingerprint,
      };
      node.port.postMessage(message);
      setInstrumentReady(true);
    } catch (error) {
      if (generation !== instrumentGeneration.current) return;
      setInstrumentFailure(error instanceof Error ? error.message : String(error));
      setInstrumentReady(false);
    }
  }

  function disposeResources(): void {
    instrumentGeneration.current += 1;
    const current = resources.current;
    if (current === undefined) return;
    current.playback.stop();
    current.instrument?.port.postMessage({ type: "ALL_NOTES_OFF" });
    current.instrument?.disconnect();
    current.graph.disconnect();
    current.microphone.stream.getTracks().forEach((track) => track.stop());
    current.worker.terminate();
    void current.context.close();
    resources.current = undefined;
    instrumentPreparation.current = undefined;
    pendingInstrumentEvents.current.clear();
    setInstrumentReady(false);
  }

  async function start(): Promise<void> {
    let openingMicrophone: OpenedMicrophone | undefined;
    let openingContext: AudioContext | undefined;
    let openingGraph: CaptureGraph | undefined;
    let openingWorker: Worker | undefined;

    try {
      disposeResources();
      requestId.current += 1;
      const clearedLedger = clearQualifiedAttemptLedger();
      attemptLedger.current = clearedLedger;
      setAttempts([]);
      setFailureReason(undefined);
      setFingerprint(undefined);
      setCapture(undefined);
      setQuality(undefined);
      setInstrumentFailure(undefined);
      setPlaybackFailure(undefined);
      setAudioTiming(undefined);
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
      resources.current = {
        context,
        microphone,
        graph,
        worker,
        playback: new SamplePlaybackController(context),
      };
      setSettings(microphone.settings);
      setAudioTiming(initialAudioTiming(context));

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
        if (!assessment.ok) {
          setFailureReason(assessment.reason);
          setState("failure");
          return;
        }

        requestId.current += 1;
        const id = String(requestId.current);
        try {
          attemptLedger.current = beginQualifiedAttempt(
            attemptLedger.current,
            id,
            assessment.quality,
            maximumQualifiedAttempts,
          );
        } catch (error) {
          setFailureReason(error instanceof Error ? error.message : String(error));
          setState("error");
          return;
        }

        setState("analyzing");
        const samples = nextCapture.samples.slice();
        worker.postMessage(
          { type: "ANALYZE", requestId: id, samples, sampleRate: nextCapture.sampleRate },
          [samples.buffer],
        );
      };

      worker.onmessage = (event: MessageEvent<AnalysisResponse>) => {
        if (event.data.type === "FAILURE") {
          if (!settleCurrentAttempt(event.data.requestId, { status: "failure", reason: event.data.reason })) return;
          setFingerprint(undefined);
          setFailureReason(event.data.reason);
          setState("failure");
          return;
        }

        const nextFingerprint = event.data.fingerprint;
        if (!settleCurrentAttempt(event.data.requestId, { status: "success", fingerprint: nextFingerprint })) return;
        setFingerprint(nextFingerprint);
        setState("success");
        void prepareInstrument(nextFingerprint);
      };

      worker.onerror = () => {
        const pendingRequest = attemptLedger.current.pending?.requestId;
        if (pendingRequest === undefined) {
          setFailureReason("Analysis stopped unexpectedly. Start the session again.");
          setState("error");
          return;
        }
        settleCurrentAttempt(
          pendingRequest,
          { status: "failure", reason: "ANALYSIS_INTERNAL_ERROR" },
        );
        requestId.current += 1;
        setFingerprint(undefined);
        setFailureReason("Analysis stopped unexpectedly. Start the session again.");
        setState("error");
      };
    } catch (error) {
      retainInterruptedQualifiedAttempt();
      requestId.current += 1;
      if (resources.current === undefined) {
        openingGraph?.disconnect();
        openingWorker?.terminate();
        openingMicrophone?.stream.getTracks().forEach((track) => track.stop());
        if (openingContext !== undefined) void openingContext.close();
      }
      setFailureReason(microphoneStartFailureCopy(error));
      setState("error");
    }
  }

  function reset(): void {
    instrumentGeneration.current += 1;
    retainInterruptedQualifiedAttempt();
    requestId.current += 1;
    silenceAudio();
    setFailureReason(undefined);
    setFingerprint(undefined);
    setCapture(undefined);
    setQuality(undefined);
    setInstrumentReady(false);
    setInstrumentFailure(undefined);
    setPlaybackFailure(undefined);
    const node = resources.current?.graph.node;
    if (node === undefined) {
      setState("idle");
      return;
    }
    if (maximumQualifiedAttempts !== undefined && attemptLedger.current.attempts.length >= maximumQualifiedAttempts) {
      setFailureReason(`Qualified attempt limit of ${maximumQualifiedAttempts} has been reached`);
      setState("failure");
      return;
    }
    node.port.postMessage({ type: "RESET" });
    setState("warming");
  }

  function stop(): void {
    const alreadyIdle = state === "idle";
    retainInterruptedQualifiedAttempt();
    requestId.current += 1;
    disposeResources();
    setCapture(undefined);
    setQuality(undefined);
    setFingerprint(undefined);
    setFailureReason(undefined);
    setInstrumentFailure(undefined);
    setPlaybackFailure(undefined);
    if (alreadyIdle) {
      const clearedLedger = clearQualifiedAttemptLedger();
      attemptLedger.current = clearedLedger;
      setAttempts([]);
      setSettings(undefined);
      setAudioTiming(undefined);
    }
    setState("idle");
  }

  async function play(samples: Float32Array, sampleRate: number): Promise<void> {
    const playback = resources.current?.playback;
    if (playback === undefined) return;
    setPlaybackFailure(undefined);
    try {
      await playback.play(samples, sampleRate);
    } catch {
      setPlaybackFailure(playbackFailureCopy());
    }
  }

  function postNote(current: SessionResources, midiNote: number, velocity: number): boolean {
    const instrument = current.instrument;
    if (!instrumentReady || instrument === undefined || resources.current !== current) return false;
    const eventId = nextInstrumentEventId.current;
    nextInstrumentEventId.current += 1;
    pendingInstrumentEvents.current.set(eventId, current.context.currentTime);
    const message: ModalInstrumentWorkletMessage = { type: "NOTE_ON", midiNote, velocity, eventId };
    instrument.port.postMessage(message);
    return true;
  }

  function noteOn(midiNote: number, velocity = 1): boolean {
    const current = resources.current;
    if (!instrumentReady || current?.instrument === undefined) return false;
    setPlaybackFailure(undefined);
    if (current.context.state === "running") return postNote(current, midiNote, velocity);
    void current.context.resume().then(() => {
      if (current.context.state !== "running" || !postNote(current, midiNote, velocity)) {
        setPlaybackFailure(playbackFailureCopy());
      }
    }).catch(() => setPlaybackFailure(playbackFailureCopy()));
    return true;
  }

  function allNotesOff(): void {
    silenceAudio();
  }

  function playbackSampleRate(): number | undefined {
    return resources.current?.context.sampleRate;
  }

  useEffect(() => {
    const handlePageHide = (): void => silenceAudio();
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") silenceAudio();
    };
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      disposeResources();
    };
  }, []);

  return {
    state,
    settings,
    capture,
    quality,
    fingerprint,
    failureReason,
    attempts,
    instrumentReady,
    instrumentFailure,
    playbackFailure,
    audioTiming,
    start,
    reset,
    stop,
    play,
    noteOn,
    allNotesOff,
    playbackSampleRate,
  } as const;
}
