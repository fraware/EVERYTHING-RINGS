const PLAY_NOTES = [
  { midi: 60, label: "C" }, { midi: 61, label: "C♯" }, { midi: 62, label: "D" },
  { midi: 63, label: "D♯" }, { midi: 64, label: "E" }, { midi: 65, label: "F" },
  { midi: 66, label: "F♯" }, { midi: 67, label: "G" }, { midi: 68, label: "G♯" },
  { midi: 69, label: "A" }, { midi: 70, label: "A♯" }, { midi: 71, label: "B" },
  { midi: 72, label: "C" },
] as const;

export function PlayableKeyboard({
  onNote,
  id = "consumer-playable-keys",
  ariaLabel = "Chromatic playable keys",
}: {
  readonly onNote: (midiNote: number) => void;
  readonly id?: string;
  readonly ariaLabel?: string;
}) {
  return <section className="consumer-instrument" id={id} aria-label="Playable fingerprint">
    <p className="consumer-kicker">PLAY</p>
    <div className="consumer-keyboard" role="group" aria-label={ariaLabel}>
      {PLAY_NOTES.map((note, index) => <button
        key={`${note.midi}-${index}`}
        aria-label={`Play ${note.label}, MIDI ${note.midi}`}
        onPointerDown={() => onNote(note.midi)}
        onClick={(event) => { if (event.detail === 0) onNote(note.midi); }}
      >{note.label}</button>)}
    </div>
  </section>;
}
