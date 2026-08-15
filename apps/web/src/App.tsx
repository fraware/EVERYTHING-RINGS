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
import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";
import { useEffect, useMemo, useRef, useState } from "react";
import captureWorkletUrl from "../../../packages/acquisition/src/worklet/capture-processor.ts?worker&url";

type LabState =
  | "idle"
  | "warming"
  | "armed"
  | "capturing"
  | "analyzing"
  | "success"
  | "failure"
  | "error";

type AnalysisResponse =
  | { readonly type: "SUCCESS"; readonly requestId: string; readonly fingerprint: AcousticFingerprintV1 }
  | { readonly type: "FAILURE"; readonly requestId: string; readonly reason: string };

interface RecordedFingerprint {
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

function centsDistance(leftHz: number, rightHz: number): number {
  return 1200 * Math.abs(Math.log2(rightHz / leftHz));
}

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  const value = ordered[middle];
  if (value === undefined) return undefined;
  if (ordered.length % 2 === 1) return value;
  return ((ordered[middle - 1] ?? value) + value) / 2;
}

function fingerprintDriftCents(
  reference: AcousticFingerprintV1,
  candidate: AcousticFingerprintV1,
): number | undefined {
  const referenceModes = reference.modes.slice(0, 8);
  const distances = referenceModes.map((mode) => {
    const nearest = [...candidate.modes].sort(
      (left, right) =>
        centsDistance(mode.frequencyHz, left.frequencyHz) -
        centsDistance(mode.frequencyHz, right.frequencyHz),
    )[0];
    return nearest === undefined ? undefined : centsDistance(mode.frequencyHz, nearest.frequencyHz);
  });
  return median(distances.filter((value): value is number => value !== undefined));
}

function failureCopy(reason: string): string {
  switch (reason) {
    case "TOO_QUIET":
      return "The strike was too quiet. Move closer or use a more resonant object.";
    case "CLIPPED":
      return "The strike clipped the microphone. Move the device farther away and try again.";
    case "LOW_SNR":
      return "Background sound masked the ring. Try again in a quieter position.";
    case "MULTIPLE_IMPACTS":
      return "We detected another strong impact. Strike the object once.";
    case "NO_STABLE_RESONANCES":
      return "No stable resonances survived the analysis gate.";
    default:
      return reason;
  }
}

function Waveform({ capture }: { readonly capture: AudioCapture }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const context = canvas.getContext("2d");
    if (context === null) return;
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.strokeStyle = "#d7d7d2";
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x < width; x += 1) {
      const start = Math.floor((x / width) * capture.samples.length);
      const end = Math.max(start + 1, Math.floor(((x + 1) / width) * capture.samples.length));
      let peak = 0;
      for (let index = start; index < Math.min(end, capture.samples.length); index += 1) {
        peak = Math.max(peak, Math.abs(capture.samples[index] ?? 0));
      }
      context.moveTo(x + 0.5, height / 2 - peak * height * 0.45);
      context.lineTo(x + 0.5, height / 2 + peak * height * 0.45);
    }
    context.stroke();
    const triggerX = (capture.triggerSample / capture.samples.length) * width;
    context.strokeStyle = "#8a8a84";
    context.beginPath();
    context.moveTo(triggerX, 0);
    context.lineTo(triggerX, height);
    context.stroke();
  }, [capture]);
  return <canvas ref={canvasRef} width={1000} height={180} className="waveform" aria-label="Captured waveform" />;
}

function ModeTable({ modes }: { readonly modes: readonly AcousticMode[] }) {
  return (
    <div className="mode-table" role="table" aria-label="Estimated acoustic modes">
      <div className="mode-row mode-head" role="row">
        <span>Hz</span><span>decay</span><span>Q</span><span>confidence</span>
      </div>
      {modes.map((mode) => (
        <div className="mode-row" role="row" key={`${mode.frequencyHz}-${mode.decaySeconds}`}>
          <span>{mode.frequencyHz.toFixed(1)}</span>
          <span>{mode.decaySeconds.toFixed(3)} s</span>
          <span>{mode.q.toFixed(0)}</span>
          <span>{mode.confidence.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export function App() {
  const [labState, setLabState] = useState<LabState>("idle");
  const [settings, setSettings] = useState<CaptureSettingsSnapshot>();
  const [capture, setCapture] = useState<AudioCapture>();
  const [quality, setQuality] = useState<CaptureQuality>();
  const [fingerprint, setFingerprint] = useState<AcousticFingerprintV1>();
  const [failure, setFailure] = useState<string>();
  const [records, setRecords] = useState<RecordedFingerprint[]>([]);
  const resources = useRef<SessionResources | undefined>(undefined);
  const requestId = useRef(0);
  const pendingQuality = useRef<CaptureQuality | undefined>(undefined);

  const drift = useMemo(() => {
    if (records.length < 2) return undefined;
    const reference = records[0]?.fingerprint;
    if (reference === undefined) return undefined;
    const values = records.slice(1).map((record) => fingerprintDriftCents(reference, record.fingerprint));
    return median(values.filter((value): value is number => value !== undefined));
  }, [records]);

  async function start(): Promise<void> {
    try {
      setFailure(undefined);
      setFingerprint(undefined);
      setCapture(undefined);
      const microphone = await openMicrophone();
      const context = new AudioContext();
      await context.resume();
      const graph = await createCaptureGraph(context, microphone.stream, captureWorkletUrl);
      const worker = new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" });
      resources.current = { context, microphone, graph, worker };
      setSettings(microphone.settings);
      setLabState("warming");

      graph.node.port.onmessage = (event: MessageEvent<CaptureWorkletEvent>) => {
        if (event.data.type === "STATE") {
          if (event.data.state === "warming") setLabState("warming");
          if (event.data.state === "armed") setLabState("armed");
          if (event.data.state === "capturing") setLabState("capturing");
          return;
        }
        const nextCapture = event.data.capture;
        setCapture(nextCapture);
        const qualityResult = assessCaptureQuality(nextCapture);
        setQuality(qualityResult.quality);
        pendingQuality.current = qualityResult.quality;
        if (!qualityResult.ok) {
          setFailure(failureCopy(qualityResult.reason));
          setLabState("failure");
          return;
        }
        setLabState("analyzing");
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
          setFailure(failureCopy(event.data.reason));
          setLabState("failure");
          return;
        }
        setFingerprint(event.data.fingerprint);
        setRecords((current) => [
          ...current,
          {
            id: current.length + 1,
            fingerprint: event.data.fingerprint,
            quality: pendingQuality.current ?? {
              score: 0,
              snrDb: 0,
              clippedFraction: 0,
              peakAmplitude: 0,
              secondaryTransientRatio: 0,
            },
          },
        ]);
        setLabState("success");
      };
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
      setLabState("error");
    }
  }

  function resetCapture(): void {
    setFailure(undefined);
    setFingerprint(undefined);
    setCapture(undefined);
    setQuality(undefined);
    pendingQuality.current = undefined;
    resources.current?.graph.node.port.postMessage({ type: "RESET" });
    setLabState("warming");
  }

  function playOriginal(): void {
    const current = resources.current;
    if (capture === undefined || current === undefined) return;
    const buffer = current.context.createBuffer(1, capture.samples.length, capture.sampleRate);
    buffer.copyToChannel(capture.samples, 0);
    const source = current.context.createBufferSource();
    source.buffer = buffer;
    source.connect(current.context.destination);
    source.start();
  }

  function stop(): void {
    const current = resources.current;
    if (current !== undefined) {
      current.graph.disconnect();
      current.microphone.stream.getTracks().forEach((track) => track.stop());
      current.worker.terminate();
      void current.context.close();
    }
    resources.current = undefined;
    setLabState("idle");
  }

  useEffect(() => stop, []);

  return (
    <main className="shell">
      <header>
        <p className="eyebrow">EVERYTHING RINGS / GATE A</p>
        <h1>Acoustic analysis lab</h1>
        <p className="lede">Strike one resonant object once. Repeat five times. Stable modal frequencies are the gate.</p>
      </header>

      <section className="control-panel">
        <div>
          <span className={`status status-${labState}`}>{labState}</span>
          <p className="instruction">
            {labState === "idle" && "Enable the microphone to start."}
            {labState === "warming" && "Measuring the room noise floor…"}
            {labState === "armed" && "Ready. Tap the object once."}
            {labState === "capturing" && "Got it. Capturing the decay…"}
            {labState === "analyzing" && "Finding stable resonances…"}
            {labState === "success" && `${fingerprint?.modes.length ?? 0} stable resonances found.`}
            {(labState === "failure" || labState === "error") && failure}
          </p>
        </div>
        <div className="actions">
          {labState === "idle" ? <button onClick={() => void start()}>ARM MICROPHONE</button> : null}
          {labState !== "idle" ? <button onClick={resetCapture}>NEW STRIKE</button> : null}
          {capture !== undefined ? <button onClick={playOriginal}>PLAY ORIGINAL</button> : null}
          {labState !== "idle" ? <button className="secondary" onClick={stop}>STOP</button> : null}
        </div>
      </section>

      {capture !== undefined ? <Waveform capture={capture} /> : null}

      <section className="metrics-grid">
        <article>
          <h2>Capture</h2>
          <dl>
            <div><dt>sample rate</dt><dd>{capture?.sampleRate ?? settings?.sampleRate ?? "—"} Hz</dd></div>
            <div><dt>SNR</dt><dd>{quality === undefined ? "—" : `${quality.snrDb.toFixed(1)} dB`}</dd></div>
            <div><dt>peak</dt><dd>{quality === undefined ? "—" : quality.peakAmplitude.toFixed(3)}</dd></div>
            <div><dt>clipped</dt><dd>{quality === undefined ? "—" : `${(quality.clippedFraction * 100).toFixed(3)}%`}</dd></div>
            <div><dt>second impact</dt><dd>{quality === undefined ? "—" : quality.secondaryTransientRatio.toFixed(2)}</dd></div>
          </dl>
        </article>
        <article>
          <h2>Device</h2>
          <dl>
            <div><dt>channels</dt><dd>{settings?.channelCount ?? "—"}</dd></div>
            <div><dt>echo cancellation</dt><dd>{String(settings?.echoCancellation ?? "—")}</dd></div>
            <div><dt>noise suppression</dt><dd>{String(settings?.noiseSuppression ?? "—")}</dd></div>
            <div><dt>auto gain</dt><dd>{String(settings?.autoGainControl ?? "—")}</dd></div>
          </dl>
        </article>
        <article>
          <h2>Repeatability</h2>
          <dl>
            <div><dt>accepted strikes</dt><dd>{records.length} / 5</dd></div>
            <div><dt>median modal drift</dt><dd>{drift === undefined ? "—" : `${drift.toFixed(1)} cents`}</dd></div>
          </dl>
          <p className="small">Use the same object, striker, support, distance, and position for all five strikes.</p>
        </article>
      </section>

      {fingerprint !== undefined ? (
        <section className="result">
          <div className="result-head">
            <div>
              <p className="eyebrow">er-dsp-1</p>
              <h2>Estimated acoustic modes</h2>
            </div>
            <strong>{fingerprint.modes.length}</strong>
          </div>
          <ModeTable modes={fingerprint.modes} />
        </section>
      ) : null}
    </main>
  );
}
