import { renderAcousticFingerprint } from "@everything-rings/synth";
import { useState, type KeyboardEvent } from "react";
import { AcousticDnaView } from "./AcousticDnaView";
import { failureCopy } from "./failureCopy";
import { useStrikeSession } from "./useStrikeSession";

const PLAY_NOTES = [
  { midi: 60, label: "C" }, { midi: 61, label: "C♯" }, { midi: 62, label: "D" },
  { midi: 63, label: "D♯" }, { midi: 64, label: "E" }, { midi: 65, label: "F" },
  { midi: 66, label: "F♯" }, { midi: 67, label: "G" }, { midi: 68, label: "G♯" },
  { midi: 69, label: "A" }, { midi: 70, label: "A♯" }, { midi: 71, label: "B" },
  { midi: 72, label: "C" },
] as const;

function noteName(midi: number, label: string): string {
  return `${label}${Math.floor(midi / 12) - 1}`;
}

export function ConsumerApp() {
  const session = useStrikeSession();
  const [showKeyboard, setShowKeyboard] = useState(false);

  function strikeAgain(): void {
    setShowKeyboard(false);
    session.reset();
  }

  function retry(): void {
    setShowKeyboard(false);
    if (session.state === "error") {
      void session.start();
      return;
    }
    session.reset();
  }

  function hearOriginal(): void {
    const capture = session.capture;
    if (capture === undefined) return;
    void session.play(capture.samples, capture.sampleRate);
  }

  function hearModel(): void {
    const fingerprint = session.fingerprint;
    if (fingerprint === undefined) return;
    const sampleRate = session.playbackSampleRate() ?? fingerprint.sampleRate;
    void session.play(renderAcousticFingerprint(fingerprint, sampleRate), sampleRate);
  }

  function toggleKeyboard(): void {
    if (showKeyboard) session.allNotesOff();
    setShowKeyboard((value) => !value);
  }

  function playKeyFromKeyboard(event: KeyboardEvent<HTMLButtonElement>, midi: number): void {
    if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    void session.noteOn(midi);
  }

  if (session.state === "idle") {
    return <main className="consumer-shell consumer-hero">
      <p className="consumer-mark">EVERYTHING RINGS</p>
      <div className="consumer-hero-copy"><h1>Hit anything.<br />Discover how it rings.</h1><p>No upload. No account. Your microphone stays local.</p></div>
      <button type="button" className="consumer-primary" onClick={() => void session.start()}>START LISTENING</button>
      <a className="lab-link" href="?lab=1">validation lab</a>
    </main>;
  }

  if (session.state === "warming" || session.state === "armed" || session.state === "capturing" || session.state === "analyzing") {
    const copy = session.state === "warming" ? "Listening to the room…"
      : session.state === "armed" ? "Hit one object. Once."
      : session.state === "capturing" ? "It rings…"
      : "Estimating its resonances…";
    return <main className="consumer-shell consumer-stage"><p className="consumer-mark">EVERYTHING RINGS</p><div className={`pulse pulse-${session.state}`} /><h1 role="status" aria-live="polite">{copy}</h1><button type="button" className="consumer-ghost" onClick={session.stop}>CANCEL</button></main>;
  }

  if (session.state === "failure" || session.state === "error") {
    return <main className="consumer-shell consumer-stage"><p className="consumer-mark">EVERYTHING RINGS</p><p className="consumer-kicker">TRY THAT AGAIN</p><h1 role="alert">{failureCopy(session.failureReason)}</h1><div className="consumer-actions"><button type="button" className="consumer-primary" onClick={retry}>TRY AGAIN</button><button type="button" className="consumer-ghost" onClick={session.stop}>START OVER</button></div></main>;
  }

  const fingerprint = session.fingerprint;
  if (fingerprint === undefined) return null;
  const playLabel = session.instrumentFailure !== undefined
    ? "PLAY UNAVAILABLE"
    : session.instrumentReady ? (showKeyboard ? "HIDE KEYS" : "PLAY IT") : "PREPARING PLAY…";

  return <main className="consumer-shell consumer-reveal">
    <p className="consumer-mark">EVERYTHING RINGS</p>
    <section className="reveal-copy"><p className="consumer-kicker">REVEAL</p><h1>We estimated {fingerprint.modes.length} audible resonances.</h1><p>Each arc encodes one stable resonance supported by this recording.</p></section>
    <AcousticDnaView fingerprint={fingerprint} />
    <div className="consumer-actions">
      <button type="button" className="consumer-primary" disabled={session.capture === undefined} onClick={hearOriginal}>HEAR ORIGINAL</button>
      <button type="button" className="consumer-primary" onClick={hearModel}>HEAR RECONSTRUCTION</button>
      <button type="button" className="consumer-primary" disabled={!session.instrumentReady} aria-expanded={showKeyboard} aria-controls="consumer-keyboard" onClick={toggleKeyboard}>{playLabel}</button>
      <button type="button" className="consumer-ghost" onClick={strikeAgain}>STRIKE ANOTHER</button>
    </div>
    {session.playbackFailure !== undefined ? <p className="consumer-audio-error" role="alert">{session.playbackFailure}</p> : null}
    {showKeyboard && session.instrumentReady ? <section className="consumer-instrument" id="consumer-keyboard"><p className="consumer-kicker">PLAY</p><div className="consumer-keyboard" role="group" aria-label="Chromatic instrument">{PLAY_NOTES.map((note, index) => <button type="button" aria-label={noteName(note.midi, note.label)} key={`${note.midi}-${index}`} onPointerDown={() => void session.noteOn(note.midi)} onKeyDown={(event) => playKeyFromKeyboard(event, note.midi)}>{note.label}</button>)}</div></section> : null}
    <a className="lab-link" href="?lab=1">open measurements</a>
  </main>;
}
