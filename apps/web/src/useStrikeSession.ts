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
import {
  OpeningSessionResources,
  SessionLifecycleGeneration,
  ownsSessionResources,
} from "./sessionLifecycle";
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
  const pendingStartup = useRef<OpeningSessionResources | undefined>(undefined);
  const lifecycle = useRef(new SessionLifecycleGeneration());
  const stateRef = useRef<StrikeSessionState>("idle");
  const requestId = useRef(0);
  const attemptLedger = useRef<QualifiedAttemptLedger>(createQualifiedAttemptLedger());
  const instrumentPreparation = useRef<Promise<void> | undefined>(undefined);
  const instrumentGeneration = useRef(0);
  const nextInstrumentEventId = useRef(1);
  const pendingInstrumentEvents = useRef(new Map<number, number>());
  const maximumQualifiedAttempts = options.maximumQualifiedAttempts;

  function transitionState(next: StrikeSessionState): void {
    stateRef.current = next;
    setState(next);
  }

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
          if (resources.current !== current) return;
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

  function disposeSessionResources(current: SessionResources | undefined, updateUi = true): void {
    instrumentGeneration.current += 1;
    if (current === undefined) return;
    try { current.playback.stop(); } catch { /* playback already unavailable */ }
    try { current.instrument?.port.postMessage({ type: "ALL_NOTES_OFF" }); } catch { /* port already unavailable */ }
    try {
      if (current.instrument !== undefined) current.instrument.port.onmessage = null;
    } catch { /* port already unavailable */ }
    try { current.instrument?.disconnect(); } catch { /* already disconnected */ }
    try { current.graph.node.port.onmessage = null; } catch { /* port already unavailable */ }
    try { current.worker.onmessage = null; } catch { /* worker already unavailable */ }
    try { current.worker.onerror = null; } catch { /* worker already unavailable */ }
    try { current.graph.disconnect(); } catch { /* already disconnected */ }
    current.microphone.stream.getTracks().forEach((track) => {
      try { track.stop(); } catch { /* already stopped */ }
    });
    try { current.worker.terminate(); } catch { /* already terminated */ }
    try { void current.context.close().catch(() => undefined); } catch { /* already closed */ }
    if (resources.current === current) resources.current = undefined;
    instrumentPreparation.current = undefined;
    pendingInstrumentEvents.current.clear();
    if (updateUi) setInstrumentReady(false);
  }

  function supersedeLifecycle(): number {
    const generation = lifecycle.current.begin();
    const opening = pendingStartup.current;
    pendingStartup.current = undefined;
    opening?.dispose();
    const current = resources.current;
    resources.current = undefined;
    disposeSessionResources(current);
    return generation;
  }

  function invalidateLifecycle(updateUi = true): void {
    lifecycle.current.invalidate();
    const opening = pendingStartup.current;
    pendingStartup.current = undefined;
    opening?.dispose();
    const current = resources.current;
    resources.current = undefined;
    disposeSessionResources(current, updateUi);
  }

  function clearPendingStartup(opening: OpeningSessionResources): void {
    if (pendingStartup.current === opening) pendingStartup.current = undefined;
  }

  async function start(): Promise<void> {
    const generation = supersedeLifecycle();
    const opening = new OpeningSessionResources();
    pendingStartup.current = opening;

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
    transitionState("warming");

    try {
      const microphone = await openMicrophone();
      if (!opening.attachMicrophone(microphone) || !lifecycle.current.owns(generation)) {
        opening.dispose();
        clearPendingStartup(opening);
        return;
      }

      const context = new AudioContext();
      if (!opening.attachContext(context) || !lifecycle.current.owns(generation)) {
        opening.dispose();
        clearPendingStartup(opening);
        return;
      }

      await context.resume();
      if (!lifecycle.current.owns(generation)) {
        opening.dispose();
        clearPendingStartup(opening);
        return;
      }

      const graph = await createCaptureGraph(context, microphone.stream, captureWorkletUrl);
      if (!opening.attachGraph(graph) || !lifecycle.current.owns(generation)) {
        opening.dispose();
        clearPendingStartup(opening);
        return;
      }

      const worker = new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" });
      if (!opening.attachWorker(worker) || !lifecycle.current.owns(generation)) {
        opening.dispose();
        clearPendingStartup(opening);
        return;
      }

      if (!lifecycle.current.owns(generation)) {
        opening.dispose();
        clearPendingStartup(opening);
        return;
      }
      const playback = new SamplePlaybackController(context);
      const claimed = opening.claim();
      clearPendingStartup(opening);
      if (claimed === undefined) {
        opening.dispose();
        throw new Error("Session startup could not claim complete resources");
      }

      const current: SessionResources = {
        context: claimed.context,
        microphone: claimed.microphone,
        graph: claimed.graph,
        worker: claimed.worker,
        playback,
      };
      resources.current = current;
      setSettings(current.microphone.settings);
      setAudioTiming(initialAudioTiming(current.context));

      current.graph.node.port.onmessage = (event: MessageEvent<CaptureWorkletEvent>) => {
        if (!ownsSessionResources(lifecycle.current, generation, resources.current, current)) return;
        if (event.data.type === "STATE") {
          if (event.data.state === "warming") transitionState("warming");
          if (event.data.state === "armed") transitionState("armed");
          if (event.data.state === "capturing") transitionState("capturing");
          return;
        }

        const nextCapture = event.data.capture;
        setCapture(nextCapture);
        const assessment = assessCaptureQuality(nextCapture);
        setQuality(assessment.quality);
        if (!assessment.ok) {
          setFailureReason(assessment.reason);
          transitionState("failure");
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
          transitionState("error");
          return;
        }

        transitionState("analyzing");
        const samples = nextCapture.samples.slice();
        current.worker.postMessage(
          { type: "ANALYZE", requestId: id, samples, sampleRate: nextCapture.sampleRate },
          [samples.buffer],
        );
      };

      current.worker.onmessage = (event: MessageEvent<AnalysisResponse>) => {
        if (!ownsSessionResources(lifecycle.current, generation, resources.current, current)) return;
        if (event.data.type === "FAILURE") {
          if (!settleCurrentAttempt(event.data.requestId, { status: "failure", reason: event.data.reason })) return;
          setFingerprint(undefined);
          setFailureReason(event.data.reason);
          transitionState("failure");
          return;
        }

        const nextFingerprint = event.data.fingerprint;
        if (!settleCurrentAttempt(event.data.requestId, { status: "success", fingerprint: nextFingerprint })) return;
        setFingerprint(nextFingerprint);
        transitionState("success");
        void prepareInstrument(nextFingerprint);
      };

      current.worker.onerror = () => {
        if (!ownsSessionResources(lifecycle.current, generation, resources.current, current)) return;
        const pendingRequest = attemptLedger.current.pending?.requestId;
        if (pendingRequest === undefined) {
          setFailureReason("Analysis stopped unexpectedly. Start the session again.");
          transitionState("error");
          return;
        }
        settleCurrentAttempt(
          pendingRequest,
          { status: "failure", reason: "ANALYSIS_INTERNAL_ERROR" },
        );
        requestId.current += 1;
        setFingerprint(undefined);
        setFailureReason("Analysis stopped unexpectedly. Start the session again.");
        transitionState("error");
      };
    } catch (error) {
      const stillCurrent = lifecycle.current.owns(generation);
      opening.dispose();
      clearPendingStartup(opening);
      if (!stillCurrent) return;
      retainInterruptedQualifiedAttempt();
      requestId.current += 1;
      setFailureReason(microphoneStartFailureCopy(error));
      transitionState("error");
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
      transitionState("idle");
      return;
    }
    if (maximumQualifiedAttempts !== undefined && attemptLedger.current.attempts.length >= maximumQualifiedAttempts) {
      setFailureReason(`Qualified attempt limit of ${maximumQualifiedAttempts} has been reached`);
      transitionState("failure");
      return;
    }
    node.port.postMessage({ type: "RESET" });
    transitionState("warming");
  }

  function stop(): void {
    const alreadyIdle = stateRef.current === "idle";
    retainInterruptedQualifiedAttempt();
    requestId.current += 1;
    invalidateLifecycle();
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
    transitionState("idle");
  }

  async function play(samples: Float32Array, sampleRate: number): Promise<void> {
    const current = resources.current;
    const playback = current?.playback;
    if (current === undefined || playback === undefined) return;
    setPlaybackFailure(undefined);
    try {
      await playback.play(samples, sampleRate);
    } catch {
      if (resources.current === current) setPlaybackFailure(playbackFailureCopy());
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
      if (resources.current !== current) return;
      if (current.context.state !== "running" || !postNote(current, midiNote, velocity)) {
        setPlaybackFailure(playbackFailureCopy());
      }
    }).catch(() => {
      if (resources.current === current) setPlaybackFailure(playbackFailureCopy());
    });
    return true;
  }

  function allNotesOff(): void {
    silenceAudio();
  }

  function playbackSampleRate(): number | undefined {
    return resources.current?.context.sampleRate;
  }

  useEffect(() => {
    const handlePageHide = (): void => stop();
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") silenceAudio();
    };
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      invalidateLifecycle(false);
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
