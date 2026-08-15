import { renderAcousticFingerprint } from "@everything-rings/synth";
import { useState } from "react";
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

  function hearModel(): void {
    const fingerprint = session.fingerprint;
    if (fingerprint === undefined) return;
    const sampleRate = session.playbackSampleRate() ?? fingerprint.sampleRate;
    session.play(renderAcousticFingerprint(fingerprint, sampleRate), sampleRate);
  }

  if (session.state === "idle") {
    return <main className="consumer-shell consumer-hero">
      <p className="consumer-mark">EVERYTHING RINGS</p>
      <div className="consumer-hero-copy"><h1>Hit anything.<br />Discover how it rings.</h1><p>No upload. No account. Your microphone stays local.</p></div>
      <button className="consumer-primary" onClick={() => void session.start()}>START LISTENING</button>
      <a className="lab-link" href="?lab=1">validation lab</a>
    </main>;
  }

  if (session.state === "warming" || session.state === "armed" || session.state === "capturing" || session.state === "analyzing") {
    const copy = session.state === "warming" ? "Listening to the room…"
      : session.state === "armed" ? "Hit one object. Once."
      : session.state === "capturing" ? "It rings…"
      : "Finding its resonances…";
    return <main className="consumer-shell consumer-stage"><p className="consumer-mark">EVERYTHING RINGS</p><div className={`pulse pulse-${session.state}`} /><h1>{copy}</h1><button className="consumer-ghost" onClick={session.stop}>CANCEL</button></main>;
  }

  if (session.state === "failure" || session.state === "error") {
    return <main className="consumer-shell consumer-stage"><p className="consumer-mark">EVERYTHING RINGS</p><p className="consumer-kicker">TRY THAT AGAIN</p><h1>{failureCopy(session.failureReason)}</h1><div className="consumer-actions"><button className="consumer-primary" onClick={retry}>TRY AGAIN</button><button className="consumer-ghost" onClick={session.stop}>START OVER</button></div></main>;
  }

  const fingerprint = session.fingerprint;
  if (fingerprint === undefined) return null;
  const playLabel = session.instrumentFailure !== undefined
    ? "PLAY UNAVAILABLE"
    : session.instrumentReady ? "PLAY IT" : "PREPARING PLAY…";

  return <main className="consumer-shell consumer-reveal">
    <p className="consumer-mark">EVERYTHING RINGS</p>
    <section className="reveal-copy"><p className="consumer-kicker">REVEAL</p><h1>You found {fingerprint.modes.length} resonances.</h1><p>Each arc is one measured ring in this object.</p></section>
    <AcousticDnaView fingerprint={fingerprint} />
    <div className="consumer-actions"><button className="consumer-primary" onClick={hearModel}>HEAR THE MODEL</button><button className="consumer-primary" disabled={!session.instrumentReady} onClick={() => setShowKeyboard((value) => !value)}>{playLabel}</button><button className="consumer-ghost" onClick={strikeAgain}>STRIKE ANOTHER</button></div>
    {showKeyboard && session.instrumentReady ? <section className="consumer-instrument"><p className="consumer-kicker">PLAY</p><div className="consumer-keyboard">{PLAY_NOTES.map((note, index) => <button key={`${note.midi}-${index}`} onPointerDown={() => session.noteOn(note.midi)}>{note.label}</button>)}</div></section> : null}
    <a className="lab-link" href="?lab=1">open measurements</a>
  </main>;
}
