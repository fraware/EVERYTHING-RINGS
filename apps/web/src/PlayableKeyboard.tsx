import "./playableKeyboard.css";

const PLAY_NOTES = [
  { midi: 60, label: "C", fullLabel: "C4" }, { midi: 61, label: "C♯", fullLabel: "C♯4" }, { midi: 62, label: "D", fullLabel: "D4" },
  { midi: 63, label: "D♯", fullLabel: "D♯4" }, { midi: 64, label: "E", fullLabel: "E4" }, { midi: 65, label: "F", fullLabel: "F4" },
  { midi: 66, label: "F♯", fullLabel: "F♯4" }, { midi: 67, label: "G", fullLabel: "G4" }, { midi: 68, label: "G♯", fullLabel: "G♯4" },
  { midi: 69, label: "A", fullLabel: "A4" }, { midi: 70, label: "A♯", fullLabel: "A♯4" }, { midi: 71, label: "B", fullLabel: "B4" },
  { midi: 72, label: "C", fullLabel: "C5" },
] as const;

interface ConsumerPlayableKeyboardProps {
  readonly onNote: (midiNote: number) => void;
  readonly onNoteOn?: never;
  readonly id?: string;
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
  readonly playbackFailure?: never;
}

interface LabPlayableKeyboardProps {
  readonly onNote?: never;
  readonly onNoteOn: (midiNote: number) => boolean;
  readonly id?: string;
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
  readonly playbackFailure?: string | undefined;
}

type PlayableKeyboardProps = ConsumerPlayableKeyboardProps | LabPlayableKeyboardProps;

function isLabSurface(props: PlayableKeyboardProps): props is LabPlayableKeyboardProps {
  return props.onNoteOn !== undefined;
}

function PlayableKeys({
  onNote,
  disabled,
  className,
  ariaLabel,
  showOctave,
}: {
  readonly onNote: (midiNote: number) => void;
  readonly disabled: boolean;
  readonly className: string;
  readonly ariaLabel: string;
  readonly showOctave: boolean;
}) {
  return <div className={className} role="group" aria-label={ariaLabel}>
    {PLAY_NOTES.map((note, index) => <button
      type="button"
      key={`${note.midi}-${index}`}
      aria-label={`Play ${note.fullLabel}, MIDI ${note.midi}`}
      disabled={disabled}
      onPointerDown={() => onNote(note.midi)}
      onClick={(event) => { if (event.detail === 0) onNote(note.midi); }}
    >{showOctave ? note.fullLabel : note.label}</button>)}
  </div>;
}

export function PlayableKeyboard(props: PlayableKeyboardProps) {
  if (isLabSurface(props)) {
    return <>
      <PlayableKeys
        onNote={(midiNote) => { props.onNoteOn(midiNote); }}
        disabled={props.disabled ?? false}
        className="keyboard playable-keys playable-keys-lab"
        ariaLabel={props.ariaLabel ?? "Chromatic playable object"}
        showOctave
      />
      {props.playbackFailure !== undefined
        ? <p className="validation-note" role="alert">{props.playbackFailure}</p>
        : null}
    </>;
  }

  return <section className="consumer-instrument" id={props.id ?? "consumer-playable-keys"} aria-label="Playable fingerprint">
    <p className="consumer-kicker">PLAY</p>
    <PlayableKeys
      onNote={props.onNote}
      disabled={props.disabled ?? false}
      className="consumer-keyboard playable-keys"
      ariaLabel={props.ariaLabel ?? "Chromatic playable keys"}
      showOctave={false}
    />
  </section>;
}
