import type { AcousticMode } from "@everything-rings/dsp";
import { fingerprintRecurrence } from "@everything-rings/fingerprint";
import { chooseAnchorMode, renderPlayableNote } from "@everything-rings/instrument";
import { renderAcousticFingerprint } from "@everything-rings/synth";
import { useMemo, useRef, useEffect } from "react";
import { AcousticDnaView } from "./AcousticDnaView";
import { failureCopy } from "./failureCopy";
import { useStrikeSession } from "./useStrikeSession";

const KEYBOARD_NOTES = [
  { midi: 60, label: "C4" }, { midi: 61, label: "C♯4" }, { midi: 62, label: "D4" },
  { midi: 63, label: "D♯4" }, { midi: 64, label: "E4" }, { midi: 65, label: "F4" },
  { midi: 66, label: "F♯4" }, { midi: 67, label: "G4" }, { midi: 68, label: "G♯4" },
  { midi: 69, label: "A4" }, { midi: 70, label: "A♯4" }, { midi: 71, label: "B4" },
  { midi: 72, label: "C5" },
] as const;

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  const value = ordered[middle];
  if (value === undefined) return undefined;
  if (ordered.length % 2 === 1) return value;
  return ((ordered[middle - 1] ?? value) + value) / 2;
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
  const session = useStrikeSession();
  const fingerprint = session.fingerprint;
  const drift = useMemo(() => {
    if (session.records.length < 2) return undefined;
    const reference = session.records[0]?.fingerprint;
    if (reference === undefined) return undefined;
    return median(session.records.slice(1).map((record) => fingerprintRecurrence(reference, record.fingerprint).medianCents));
  }, [session.records]);
  const anchor = useMemo(() => fingerprint === undefined ? undefined : chooseAnchorMode(fingerprint), [fingerprint]);

  function playOriginal(): void {
    if (session.capture !== undefined) session.play(session.capture.samples, session.capture.sampleRate);
  }
  function playModel(): void {
    if (fingerprint === undefined) return;
    const sampleRate = session.playbackSampleRate() ?? fingerprint.sampleRate;
    session.play(renderAcousticFingerprint(fingerprint, sampleRate), sampleRate);
  }
  function playNote(midiNote: number): void {
    if (fingerprint === undefined) return;
    const sampleRate = session.playbackSampleRate() ?? fingerprint.sampleRate;
    const note = renderPlayableNote(fingerprint, midiNote, sampleRate);
    session.play(note.samples, sampleRate);
  }

  return (
    <main className="shell">
      <header>
        <p className="eyebrow">EVERYTHING RINGS / VALIDATION LAB</p>
        <h1>Acoustic analysis lab</h1>
        <p className="lede">Measure repeatability, compare reconstruction, and test playable identity from one captured object.</p>
      </header>
      <section className="control-panel">
        <div>
          <span className={`status status-${session.state}`}>{session.state}</span>
          <p className="instruction">
            {session.state === "idle" && "Enable the microphone to start."}
            {session.state === "warming" && "Measuring the room noise floor…"}
            {session.state === "armed" && "Ready. Tap the object once."}
            {session.state === "capturing" && "Capturing the decay…"}
            {session.state === "analyzing" && "Finding stable resonances…"}
            {session.state === "success" && `${fingerprint?.modes.length ?? 0} stable resonances found.`}
            {(session.state === "failure" || session.state === "error") && failureCopy(session.failureReason)}
          </p>
        </div>
        <div className="actions">
          {session.state === "idle" ? <button onClick={() => void session.start()}>ARM MICROPHONE</button> : null}
          {session.state !== "idle" ? <button onClick={session.reset}>NEW STRIKE</button> : null}
          {session.capture !== undefined ? <button onClick={playOriginal}>PLAY ORIGINAL</button> : null}
          {fingerprint !== undefined ? <button onClick={playModel}>PLAY MODEL</button> : null}
          {session.state !== "idle" ? <button className="secondary" onClick={session.stop}>STOP</button> : null}
        </div>
      </section>

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
        </dl></article>
        <article><h2>Repeatability</h2><dl>
          <div><dt>accepted strikes</dt><dd>{session.records.length} / 5</dd></div>
          <div><dt>median modal drift</dt><dd>{drift === undefined ? "—" : `${drift.toFixed(1)} cents`}</dd></div>
          <div><dt>play anchor</dt><dd>{anchor === undefined ? "—" : `${anchor.frequencyHz.toFixed(1)} Hz`}</dd></div>
        </dl></article>
      </section>

      {fingerprint !== undefined ? <section className="result">
        <div className="result-head"><div><p className="eyebrow">er-dsp-1</p><h2>Estimated acoustic modes</h2></div><strong>{fingerprint.modes.length}</strong></div>
        <AcousticDnaView fingerprint={fingerprint} />
        <ModeTable modes={fingerprint.modes} />
        <div className="listening-lab"><div><p className="eyebrow">GATE B</p><h3>Original / modal reconstruction</h3><p className="small">The model contains no recorded audio.</p></div><div className="actions"><button onClick={playOriginal}>ORIGINAL</button><button onClick={playModel}>MODEL</button></div></div>
        <div className="instrument-lab"><p className="eyebrow">GATE C</p><h3>Play the object</h3><div className="keyboard">{KEYBOARD_NOTES.map((note) => <button key={note.midi} onClick={() => playNote(note.midi)}>{note.label}</button>)}</div></div>
      </section> : null}
    </main>
  );
}
