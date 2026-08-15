import type { AcousticMode } from "@everything-rings/dsp";
import { chooseAnchorMode } from "@everything-rings/instrument";
import { renderAcousticFingerprint } from "@everything-rings/synth";
import {
  deriveEvidenceRecurrence,
  deriveMedianModalDriftCents,
  evaluateGateASession,
  type FixedSetupProtocol,
  type GateBReview,
  type GateCReview,
  type MaterialClass,
  type ValidationEvidenceV4,
  type ValidationObjectMetadata,
} from "@everything-rings/validation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AcousticDnaView } from "./AcousticDnaView";
import { failureCopy } from "./failureCopy";
import { GateReviewPanel } from "./GateReviewPanel";
import { useStrikeSession } from "./useStrikeSession";

const KEYBOARD_NOTES = [
  { midi: 60, label: "C4" }, { midi: 61, label: "C♯4" }, { midi: 62, label: "D4" },
  { midi: 63, label: "D♯4" }, { midi: 64, label: "E4" }, { midi: 65, label: "F4" },
  { midi: 66, label: "F♯4" }, { midi: 67, label: "G4" }, { midi: 68, label: "G♯4" },
  { midi: 69, label: "A4" }, { midi: 70, label: "A♯4" }, { midi: 71, label: "B4" },
  { midi: 72, label: "C5" },
] as const;

const MATERIALS: readonly { readonly value: MaterialClass; readonly label: string }[] = [
  { value: "metal", label: "metal" },
  { value: "glass", label: "glass" },
  { value: "ceramic", label: "ceramic" },
  { value: "wood", label: "wood" },
  { value: "stone", label: "stone" },
  { value: "plastic", label: "plastic" },
  { value: "composite", label: "composite" },
  { value: "other", label: "other" },
];

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Waveform({ samples, triggerSample }: { readonly samples: Float32Array; readonly triggerSample: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas === null || canvas === undefined || context === null || context === undefined) return;
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.strokeStyle = "#d7d7d2";
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x < width; x += 1) {
      const start = Math.floor((x / width) * samples.length);
      const end = Math.max(start + 1, Math.floor(((x + 1) / width) * samples.length));
      let peak = 0;
      for (let index = start; index < Math.min(end, samples.length); index += 1) {
        peak = Math.max(peak, Math.abs(samples[index] ?? 0));
      }
      context.moveTo(x + 0.5, height / 2 - peak * height * 0.45);
      context.lineTo(x + 0.5, height / 2 + peak * height * 0.45);
    }
    context.stroke();
    const triggerX = (triggerSample / samples.length) * width;
    context.strokeStyle = "#8a8a84";
    context.beginPath();
    context.moveTo(triggerX, 0);
    context.lineTo(triggerX, height);
    context.stroke();
  }, [samples, triggerSample]);
  return <canvas ref={canvasRef} width={1000} height={180} className="waveform" aria-label="Captured waveform" />;
}

function ModeTable({ modes }: { readonly modes: readonly AcousticMode[] }) {
  return (
    <div className="mode-table" role="table" aria-label="Estimated acoustic modes">
      <div className="mode-row mode-head" role="row"><span>Hz</span><span>decay</span><span>Q</span><span>confidence</span></div>
      {modes.map((mode) => (
        <div className="mode-row" role="row" key={`${mode.frequencyHz}-${mode.decaySeconds}`}>
          <span>{mode.frequencyHz.toFixed(1)}</span><span>{mode.decaySeconds.toFixed(3)} s</span>
          <span>{mode.q.toFixed(0)}</span><span>{mode.confidence.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export function LabApp() {
  const session = useStrikeSession({ maximumQualifiedAttempts: 5 });
  const fingerprint = session.fingerprint;
  const [sessionId, setSessionId] = useState(createSessionId);
  const [specimenId, setSpecimenId] = useState("");
  const [objectLabel, setObjectLabel] = useState("");
  const [material, setMaterial] = useState<MaterialClass>("metal");
  const [microphoneDistanceCm, setMicrophoneDistanceCm] = useState(20);
  const [striker, setStriker] = useState("finger tap");
  const [strikeLocation, setStrikeLocation] = useState("marked point");
  const [supportCondition, setSupportCondition] = useState("held consistently");
  const [activeObject, setActiveObject] = useState<ValidationObjectMetadata>();
  const [activeProtocol, setActiveProtocol] = useState<FixedSetupProtocol>();
  const [gateBReviews, setGateBReviews] = useState<GateBReview[]>([]);
  const [gateCReviews, setGateCReviews] = useState<GateCReview[]>([]);

  const anchor = useMemo(() => fingerprint === undefined ? undefined : chooseAnchorMode(fingerprint), [fingerprint]);
  const protocolReady = specimenId.trim().length > 0
    && objectLabel.trim().length > 0
    && striker.trim().length > 0
    && strikeLocation.trim().length > 0
    && supportCondition.trim().length > 0
    && Number.isFinite(microphoneDistanceCm)
    && microphoneDistanceCm > 0;
  const protocolLocked = activeObject !== undefined && activeProtocol !== undefined;
  const attemptLimitReached = session.attempts.length >= 5;
  const successfulAnalyses = session.attempts.filter((attempt) => attempt.analysis.status === "success").length;
  const analyticalFailures = session.attempts.length - successfulAnalyses;
  const recurrence = useMemo(() => deriveEvidenceRecurrence(session.attempts), [session.attempts]);
  const drift = useMemo(() => deriveMedianModalDriftCents(session.attempts), [session.attempts]);

  function evidence(createdAt: string): ValidationEvidenceV4 | undefined {
    if (activeObject === undefined || activeProtocol === undefined) return undefined;
    return {
      schemaVersion: 4,
      evidenceContractVersion: "validation-evidence-4",
      gateAContractVersion: "gate-a-2",
      sessionId,
      createdAt,
      object: activeObject,
      protocol: activeProtocol,
      captureSettings: session.settings ?? null,
      realtimeAudioTiming: session.audioTiming ?? null,
      attemptCount: session.attempts.length,
      medianModalDriftCents: drift,
      recurrence,
      attempts: session.attempts,
      gateBReviews,
      gateCReviews,
      rawMicrophoneSamplesIncluded: false,
    };
  }

  const gateAVerdict = useMemo(() => {
    if (activeObject === undefined || activeProtocol === undefined) return undefined;
    const preview: ValidationEvidenceV4 = {
      schemaVersion: 4,
      evidenceContractVersion: "validation-evidence-4",
      gateAContractVersion: "gate-a-2",
      sessionId,
      createdAt: "preview",
      object: activeObject,
      protocol: activeProtocol,
      captureSettings: session.settings ?? null,
      realtimeAudioTiming: session.audioTiming ?? null,
      attemptCount: session.attempts.length,
      medianModalDriftCents: drift,
      recurrence,
      attempts: session.attempts,
      gateBReviews,
      gateCReviews,
      rawMicrophoneSamplesIncluded: false,
    };
    return evaluateGateASession(preview);
  }, [
    activeObject,
    activeProtocol,
    sessionId,
    session.settings,
    session.audioTiming,
    session.attempts,
    drift,
    recurrence,
    gateBReviews,
    gateCReviews,
  ]);
  const gateAPassed = gateAVerdict?.passed ?? false;
  const reviewAttemptId = gateAVerdict?.reviewAttemptId ?? undefined;
  const recoverableTerminalState = session.state === "success" || session.state === "failure";
  const canStartNextAttempt = recoverableTerminalState && !attemptLimitReached;

  function startSession(): void {
    if (!protocolReady) return;
    setSessionId(createSessionId());
    setActiveObject({ specimenId: specimenId.trim(), label: objectLabel.trim(), material });
    setActiveProtocol({
      fixedSetup: true,
      microphoneDistanceCm,
      striker: striker.trim(),
      strikeLocation: strikeLocation.trim(),
      supportCondition: supportCondition.trim(),
    });
    setGateBReviews([]);
    setGateCReviews([]);
    void session.start();
  }

  function prepareNewObject(): void {
    session.stop();
    setActiveObject(undefined);
    setActiveProtocol(undefined);
    setGateBReviews([]);
    setGateCReviews([]);
    setSessionId(createSessionId());
  }

  function playOriginal(): void {
    if (session.capture !== undefined) session.play(session.capture.samples, session.capture.sampleRate);
  }

  function playModel(): void {
    if (fingerprint === undefined) return;
    const sampleRate = session.playbackSampleRate() ?? fingerprint.sampleRate;
    session.play(renderAcousticFingerprint(fingerprint, sampleRate), sampleRate);
  }

  function addGateBReview(review: GateBReview): void {
    setGateBReviews((current) => [
      ...current.filter((entry) => !(
        normalized(entry.reviewerId) === normalized(review.reviewerId)
        && entry.sessionId === review.sessionId
        && entry.attemptId === review.attemptId
      )),
      review,
    ]);
  }

  function addGateCReview(review: GateCReview): void {
    setGateCReviews((current) => [
      ...current.filter((entry) => !(
        normalized(entry.reviewerId) === normalized(review.reviewerId)
        && normalized(entry.deviceId) === normalized(review.deviceId)
        && entry.sessionId === review.sessionId
        && entry.attemptId === review.attemptId
      )),
      review,
    ]);
  }

  function exportEvidence(): void {
    if (session.attempts.length === 0) return;
    const report = evidence(new Date().toISOString());
    if (report === undefined) return;
    downloadJson(`everything-rings-${report.object.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}.json`, report);
  }

  const realtimeStatus = session.instrumentFailure !== undefined
    ? "unavailable"
    : session.instrumentReady ? "ready" : "preparing";
  const baseLatency = session.audioTiming?.baseLatencyMs;
  const outputLatency = session.audioTiming?.outputLatencyMs;
  const schedulingLatency = session.audioTiming?.lastSchedulingMs;

  return (
    <main className="shell">
      <header>
        <p className="eyebrow">EVERYTHING RINGS / VALIDATION LAB</p>
        <h1>Acoustic analysis lab</h1>
        <p className="lede">Measure repeatability, run blinded reconstruction review, and test playable identity from one captured object.</p>
      </header>

      <section className="protocol-panel" aria-label="Fixed setup protocol">
        <div className="protocol-heading">
          <div><p className="eyebrow">GATE A2 / FIXED SETUP</p><h2>Identify this measurement session</h2></div>
          <p className="small">{protocolLocked ? `Locked specimen ${activeObject.specimenId} (${activeObject.label}). The first five acquisition-quality-passing attempts are final; analytical failures cannot be replaced.` : "Assign one stable physical specimen ID and set the fixed setup before arming. All fields remain locked for the five qualified attempts."}</p>
        </div>
        <div className="protocol-grid">
          <label><span>specimen ID</span><input disabled={protocolLocked} value={specimenId} onChange={(event) => setSpecimenId(event.target.value)} placeholder="lab-mug-01" /></label>
          <label><span>object</span><input disabled={protocolLocked} value={objectLabel} onChange={(event) => setObjectLabel(event.target.value)} placeholder="ceramic mug" /></label>
          <label><span>material</span><select disabled={protocolLocked} value={material} onChange={(event) => setMaterial(event.target.value as MaterialClass)}>{MATERIALS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label><span>microphone distance</span><div className="input-unit"><input disabled={protocolLocked} type="number" min="1" step="1" value={microphoneDistanceCm} onChange={(event) => setMicrophoneDistanceCm(Number(event.target.value))} /><span>cm</span></div></label>
          <label><span>striker</span><input disabled={protocolLocked} value={striker} onChange={(event) => setStriker(event.target.value)} /></label>
          <label><span>strike location</span><input disabled={protocolLocked} value={strikeLocation} onChange={(event) => setStrikeLocation(event.target.value)} /></label>
          <label><span>support condition</span><input disabled={protocolLocked} value={supportCondition} onChange={(event) => setSupportCondition(event.target.value)} /></label>
        </div>
      </section>

      <section className="control-panel">
        <div>
          <span className={`status status-${session.state}`}>{session.state}</span>
          <p className="instruction">
            {session.state === "idle" && !protocolLocked && "Complete the fixed setup, then enable the microphone."}
            {session.state === "idle" && protocolLocked && "Session stopped. Export evidence or start a new object setup."}
            {session.state === "warming" && "Measuring the room noise floor…"}
            {session.state === "armed" && `Ready for qualified attempt ${Math.min(5, session.attempts.length + 1)}. Tap the object once.`}
            {session.state === "capturing" && "Capturing the decay…"}
            {session.state === "analyzing" && "This qualified attempt is locked. Finding stable resonances…"}
            {session.state === "success" && !attemptLimitReached && `${fingerprint?.modes.length ?? 0} stable resonances found. This attempt is retained.`}
            {session.state === "success" && attemptLimitReached && gateAPassed && "Five qualified attempts complete. Gate A2 passes; listening reviews are now eligible."}
            {session.state === "success" && attemptLimitReached && !gateAPassed && "Five qualified attempts complete. Gate A2 remains open; do not replace any attempt."}
            {(session.state === "failure" || session.state === "error") && failureCopy(session.failureReason)}
          </p>
        </div>
        <div className="actions">
          {session.state === "idle" && !protocolLocked ? <button disabled={!protocolReady} onClick={startSession}>ARM MICROPHONE</button> : null}
          {session.state !== "idle" ? <button disabled={!canStartNextAttempt} onClick={session.reset}>NEW QUALIFIED ATTEMPT</button> : null}
          {session.attempts.length > 0 && protocolLocked ? <button onClick={exportEvidence}>EXPORT EVIDENCE</button> : null}
          {session.state !== "idle" ? <button className="secondary" onClick={session.stop}>STOP</button> : null}
          {session.state === "idle" && protocolLocked ? <button className="secondary" onClick={prepareNewObject}>NEW OBJECT SETUP</button> : null}
        </div>
      </section>
      {!protocolReady && !protocolLocked ? <p className="validation-note">Complete every fixed-setup field before arming the microphone.</p> : null}
      {attemptLimitReached && !gateAPassed ? <p className="validation-note">The five-attempt experiment is closed. Failed analyses remain part of the evidence and cannot be replaced.</p> : null}
      {session.state === "error" ? <p className="validation-note">This session encountered an internal error. Export retained evidence, stop, and start a new session with the same specimen ID; do not continue this physical session.</p> : null}

      {session.capture !== undefined ? <Waveform samples={session.capture.samples} triggerSample={session.capture.triggerSample} /> : null}

      <section className="metrics-grid">
        <article><h2>Capture</h2><dl>
          <div><dt>sample rate</dt><dd>{session.capture?.sampleRate ?? session.settings?.sampleRate ?? "—"} Hz</dd></div>
          <div><dt>SNR</dt><dd>{session.quality === undefined ? "—" : `${session.quality.snrDb.toFixed(1)} dB`}</dd></div>
          <div><dt>peak</dt><dd>{session.quality === undefined ? "—" : session.quality.peakAmplitude.toFixed(3)}</dd></div>
          <div><dt>clipped</dt><dd>{session.quality === undefined ? "—" : `${(session.quality.clippedFraction * 100).toFixed(3)}%`}</dd></div>
        </dl></article>
        <article><h2>Device</h2><dl>
          <div><dt>channels</dt><dd>{session.settings?.channelCount ?? "—"}</dd></div>
          <div><dt>echo cancellation</dt><dd>{String(session.settings?.echoCancellation ?? "—")}</dd></div>
          <div><dt>noise suppression</dt><dd>{String(session.settings?.noiseSuppression ?? "—")}</dd></div>
          <div><dt>auto gain</dt><dd>{String(session.settings?.autoGainControl ?? "—")}</dd></div>
          <div><dt>base latency</dt><dd>{baseLatency === undefined ? "—" : `${baseLatency.toFixed(1)} ms`}</dd></div>
          <div><dt>output latency</dt><dd>{outputLatency === undefined ? "—" : `${outputLatency.toFixed(1)} ms`}</dd></div>
        </dl></article>
        <article><h2>Repeatability</h2><dl>
          <div><dt>qualified attempts</dt><dd>{session.attempts.length} / 5</dd></div>
          <div><dt>analysis success</dt><dd>{successfulAnalyses} / 5</dd></div>
          <div><dt>analysis failures</dt><dd>{analyticalFailures}</dd></div>
          <div><dt>median modal drift</dt><dd>{drift === null ? "—" : `${drift.toFixed(1)} cents`}</dd></div>
          <div><dt>Gate A2</dt><dd>{attemptLimitReached ? gateAPassed ? "PASS" : "OPEN" : "collecting"}</dd></div>
          <div><dt>play anchor</dt><dd>{anchor === undefined ? "—" : `${anchor.frequencyHz.toFixed(1)} Hz`}</dd></div>
          <div><dt>realtime engine</dt><dd>{fingerprint === undefined ? "—" : realtimeStatus}</dd></div>
          <div><dt>note scheduling</dt><dd>{schedulingLatency === undefined ? "—" : `${schedulingLatency.toFixed(1)} ms`}</dd></div>
        </dl></article>
      </section>

      {fingerprint !== undefined ? <section className="result">
        <div className="result-head"><div><p className="eyebrow">er-dsp-1</p><h2>Estimated acoustic modes</h2></div><strong>{fingerprint.modes.length}</strong></div>
        <AcousticDnaView fingerprint={fingerprint} />
        <ModeTable modes={fingerprint.modes} />
        <div className="instrument-lab"><p className="eyebrow">GATE C</p><h3>Realtime playable object</h3><p className="small">{session.instrumentReady ? "Modal voices are rendered continuously in the audio thread. Scheduling delay excludes the browser-reported output path." : session.instrumentFailure !== undefined ? "Realtime playback is unavailable in this browser session." : "Preparing the audio thread…"}</p><div className="keyboard">{KEYBOARD_NOTES.map((note) => <button key={note.midi} disabled={!session.instrumentReady} onPointerDown={() => session.noteOn(note.midi)}>{note.label}</button>)}</div></div>
        <GateReviewPanel
          sessionId={sessionId}
          attemptId={reviewAttemptId}
          objectLabel={activeObject?.label ?? ""}
          canListen={gateAPassed && session.capture !== undefined && fingerprint !== undefined}
          instrumentReady={gateAPassed && session.instrumentReady}
          playOriginal={playOriginal}
          playModel={playModel}
          gateBReviews={gateBReviews}
          gateCReviews={gateCReviews}
          onGateBReview={addGateBReview}
          onGateCReview={addGateCReview}
        />
      </section> : null}
    </main>
  );
}
