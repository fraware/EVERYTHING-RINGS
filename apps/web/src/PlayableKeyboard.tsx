import type { KeyboardEvent } from "react";
import { failureCopy } from "./failureCopy";

const PLAYABLE_NOTES = [
  { midi: 60, label: "C4" }, { midi: 61, label: "C♯4" }, { midi: 62, label: "D4" },
  { midi: 63, label: "D♯4" }, { midi: 64, label: "E4" }, { midi: 65, label: "F4" },
  { midi: 66, label: "F♯4" }, { midi: 67, label: "G4" }, { midi: 68, label: "G♯4" },
  { midi: 69, label: "A4" }, { midi: 70, label: "A♯4" }, { midi: 71, label: "B4" },
  { midi: 72, label: "C5" },
] as const;

export interface PlayableKeyboardProps {
  readonly disabled?: boolean;
  readonly playbackFailure?: string | undefined;
  readonly onNoteOn: (midiNote: number) => boolean;
}

export function PlayableKeyboard({ disabled = false, playbackFailure, onNoteOn }: PlayableKeyboardProps) {
  function activateFromKeyboard(event: KeyboardEvent<HTMLButtonElement>, midiNote: number): void {
    if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onNoteOn(midiNote);
  }

  return <>
    <div className="keyboard" role="group" aria-label="Chromatic playable object">
      {PLAYABLE_NOTES.map((note) => (
        <button
          type="button"
          key={note.midi}
          aria-label={note.label}
          disabled={disabled}
          onPointerDown={() => onNoteOn(note.midi)}
          onKeyDown={(event) => activateFromKeyboard(event, note.midi)}
        >
          {note.label}
        </button>
      ))}
    </div>
    {playbackFailure !== undefined ? <p className="validation-note" role="alert">{failureCopy(playbackFailure)}</p> : null}
  </>;
}
