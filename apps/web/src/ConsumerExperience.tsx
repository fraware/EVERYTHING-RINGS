import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { useState } from "react";
import type { ConsumerCaptureRecord } from "./consumerHistory";
import { PlayableKeyboard } from "./PlayableKeyboard";
import { ResonanceMicroscope } from "./ResonanceMicroscope";
import "./consumerUx.css";

function strongestMode(fingerprint: AcousticFingerprintV1) {
  return fingerprint.modes.reduce((strongest, mode) => (
    strongest === undefined || mode.relativeAmplitude > strongest.relativeAmplitude ? mode : strongest
  ), undefined as AcousticFingerprintV1["modes"][number] | undefined);
}

function captureDate(capturedAt: string): string {
  const date = new Date(capturedAt);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)
    : "local capture";
}

export function ConsumerLanding({
  onStart,
  recentCaptures = [],
  historyStatus,
  onOpenCapture,
  onShareCapture,
  onRemoveCapture,
  onClearCaptures,
}: {
  readonly onStart: () => void;
  readonly recentCaptures?: readonly ConsumerCaptureRecord[];
  readonly historyStatus?: string | undefined;
  readonly onOpenCapture?: ((record: ConsumerCaptureRecord) => void) | undefined;
  readonly onShareCapture?: ((record: ConsumerCaptureRecord) => void) | undefined;
  readonly onRemoveCapture?: ((id: string) => void) | undefined;
  readonly onClearCaptures?: (() => void) | undefined;
}) {
  return <main className="consumer-shell consumer-hero">
    <p className="consumer-mark">EVERYTHING RINGS</p>
    <div className="consumer-hero-copy">
      <h1>Hit anything.<br />Discover how it rings.</h1>
      <p>Tap start, allow microphone access, then make one clean strike. No upload. No account. Your microphone stays local.</p>
    </div>
    <button className="consumer-primary" onClick={onStart}>START LISTENING</button>
    <p className="consumer-tip">Best first try: a glass, bowl, mug, railing, or other object with a clear ring.</p>
    {historyStatus !== undefined ? <p className="consumer-history-status" role="status">{historyStatus}</p> : null}
    {recentCaptures.length > 0 ? <section className="consumer-history" aria-label="Recent local captures">
      <div className="consumer-history-head">
        <div>
          <p className="consumer-kicker">RECENT DISCOVERIES</p>
          <h2>Rings kept on this device.</h2>
        </div>
        {onClearCaptures !== undefined ? <button className="consumer-ghost consumer-history-clear" onClick={onClearCaptures}>CLEAR ALL</button> : null}
      </div>
      <div className="consumer-history-grid">
        {recentCaptures.slice(0, 8).map((record, index) => {
          const strongest = strongestMode(record.fingerprint);
          return <article className="consumer-history-card" key={record.id}>
            <div className="consumer-history-meta">
              <span>CAPTURE {String(index + 1).padStart(2, "0")}</span>
              <span>{captureDate(record.capturedAt)}</span>
            </div>
            <strong>{record.fingerprint.modes.length} resonances</strong>
            <span>{strongest === undefined ? "measured ring" : `${strongest.frequencyHz.toFixed(0)} Hz strongest mode`}</span>
            <code>{record.signature}</code>
            <div className="consumer-history-actions">
              {onOpenCapture !== undefined ? <button className="consumer-primary" onClick={() => onOpenCapture(record)}>OPEN</button> : null}
              {onShareCapture !== undefined ? <button className="consumer-ghost" onClick={() => onShareCapture(record)}>SHARE DNA</button> : null}
              {onRemoveCapture !== undefined ? <button className="consumer-ghost" onClick={() => onRemoveCapture(record.id)} aria-label={`Remove ${record.signature}`}>REMOVE</button> : null}
            </div>
          </article>;
        })}
      </div>
      <p className="consumer-tip">Fingerprint history only. Microphone audio is never written to this history.</p>
    </section> : null}
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
  readonly instrumentFailure?: string | undefined;
  readonly playbackFailure?: string | undefined;
  readonly historyStatus?: string | undefined;
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
  historyStatus,
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
    {historyStatus !== undefined ? <p className="consumer-history-status" role="status">{historyStatus}</p> : null}
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
    {showKeyboard && instrumentReady ? <PlayableKeyboard onNote={onNote} /> : null}
    <a className="lab-link" href="?lab=1">open measurements</a>
  </main>;
}
