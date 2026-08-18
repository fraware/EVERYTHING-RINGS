import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { useState } from "react";
import { ResonanceMicroscope } from "./ResonanceMicroscope";

const PLAY_NOTES = [
  { midi: 60, label: "C" }, { midi: 61, label: "C♯" }, { midi: 62, label: "D" },
  { midi: 63, label: "D♯" }, { midi: 64, label: "E" }, { midi: 65, label: "F" },
  { midi: 66, label: "F♯" }, { midi: 67, label: "G" }, { midi: 68, label: "G♯" },
  { midi: 69, label: "A" }, { midi: 70, label: "A♯" }, { midi: 71, label: "B" },
  { midi: 72, label: "C" },
] as const;

export function ConsumerLanding({ onStart }: { readonly onStart: () => void }) {
  return <main className="consumer-shell consumer-hero">
    <p className="consumer-mark">EVERYTHING RINGS</p>
    <div className="consumer-hero-copy">
      <h1>Hit anything.<br />Discover how it rings.</h1>
      <p>Tap start, allow microphone access, then make one clean strike. No upload. No account. Your microphone stays local.</p>
    </div>
    <button className="consumer-primary" onClick={onStart}>START LISTENING</button>
    <p className="consumer-tip">Best first try: a glass, bowl, mug, railing, or other object with a clear ring.</p>
    <a className="lab-link" href="?lab=1">validation lab</a>
  </main>;
}

export function ConsumerProgress({
  message,
  state,
  onCancel,
}: {
  readonly message: string;
  readonly state: string;
  readonly onCancel: () => void;
}) {
  return <main className="consumer-shell consumer-stage">
    <p className="consumer-mark">EVERYTHING RINGS</p>
    <div className={`pulse pulse-${state}`} aria-hidden="true" />
    <h1 role="status" aria-live="polite" aria-atomic="true">{message}</h1>
    <button className="consumer-ghost" onClick={onCancel}>CANCEL</button>
  </main>;
}

export function ConsumerFailure({
  message,
  onRetry,
  onStartOver,
}: {
  readonly message: string;
  readonly onRetry: () => void;
  readonly onStartOver: () => void;
}) {
  return <main className="consumer-shell consumer-stage">
    <p className="consumer-mark">EVERYTHING RINGS</p>
    <p className="consumer-kicker">TRY THAT AGAIN</p>
    <h1 role="alert">{message}</h1>
    <div className="consumer-actions">
      <button className="consumer-primary" onClick={onRetry}>TRY AGAIN</button>
      <button className="consumer-ghost" onClick={onStartOver}>START OVER</button>
    </div>
  </main>;
}

export interface ConsumerRevealProps {
  readonly fingerprint: AcousticFingerprintV1;
  readonly instrumentReady: boolean;
  readonly instrumentFailure?: string;
  readonly playbackFailure?: string;
  readonly onHearMode: (modeIndex: number) => void;
  readonly onHearModel: () => void;
  readonly onHearCapture: () => void;
  readonly onNote: (midiNote: number) => void;
  readonly onShareStory: () => void;
  readonly onShareDna: () => void;
  readonly onStrikeAnother: () => void;
}

export function ConsumerReveal({
  fingerprint,
  instrumentReady,
  instrumentFailure,
  playbackFailure,
  onHearMode,
  onHearModel,
  onHearCapture,
  onNote,
  onShareStory,
  onShareDna,
  onStrikeAnother,
}: ConsumerRevealProps) {
  const [showKeyboard, setShowKeyboard] = useState(false);
  const playLabel = instrumentFailure !== undefined
    ? "PLAY UNAVAILABLE"
    : instrumentReady ? (showKeyboard ? "HIDE KEYS" : "PLAY IT") : "PREPARING PLAY…";

  return <main className="consumer-shell consumer-reveal">
    <p className="consumer-mark">EVERYTHING RINGS</p>
    <section className="reveal-copy">
      <p className="consumer-kicker">REVEAL</p>
      <h1>You found {fingerprint.modes.length} resonances.</h1>
      <p>Hear the analyzed ringdown, compare its measured-mode reconstruction, inspect each resonance, then play the object as an instrument.</p>
    </section>
    {playbackFailure !== undefined ? <p className="consumer-playback-error" role="alert">{playbackFailure}</p> : null}
    <ResonanceMicroscope
      fingerprint={fingerprint}
      onHearMode={onHearMode}
      onHearAll={onHearModel}
      onHearCapture={onHearCapture}
    />
    <div className="consumer-actions" aria-label="Object actions">
      <button
        className="consumer-primary"
        disabled={!instrumentReady}
        aria-expanded={showKeyboard}
        aria-controls="consumer-playable-keys"
        onClick={() => setShowKeyboard((value) => !value)}
      >{playLabel}</button>
      <button className="consumer-ghost" onClick={onShareStory}>SHARE STORY</button>
      <button className="consumer-ghost" onClick={onShareDna}>SHARE DNA</button>
      <button className="consumer-ghost" onClick={onStrikeAnother}>STRIKE ANOTHER</button>
    </div>
    {showKeyboard && instrumentReady ? <section className="consumer-instrument" id="consumer-playable-keys" aria-label="Playable object">
      <p className="consumer-kicker">PLAY</p>
      <div className="consumer-keyboard" role="group" aria-label="Chromatic playable keys">
        {PLAY_NOTES.map((note, index) => <button
          key={`${note.midi}-${index}`}
          aria-label={`Play ${note.label}, MIDI ${note.midi}`}
          onPointerDown={() => onNote(note.midi)}
          onClick={(event) => { if (event.detail === 0) onNote(note.midi); }}
        >{note.label}</button>)}
      </div>
    </section> : null}
    <a className="lab-link" href="?lab=1">open measurements</a>
  </main>;
}
