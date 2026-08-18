import { useEffect, useRef, useState } from "react";
import type { ConsumerCaptureRecord } from "./consumerHistory";
import { PlayableKeyboard } from "./PlayableKeyboard";
import { ResonanceMicroscope } from "./ResonanceMicroscope";
import {
  SavedCaptureAudioController,
  type SavedCaptureAudioDependencies,
} from "./savedCaptureAudio";
import { playbackFailureCopy } from "./sessionErrors";
import instrumentWorkletUrl from "./instrument-processor.ts?worker&url";

function capturedAtLabel(capturedAt: string): string {
  const date = new Date(capturedAt);
  if (!Number.isFinite(date.getTime())) return capturedAt;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function browserDependencies(): SavedCaptureAudioDependencies {
  return {
    workletUrl: instrumentWorkletUrl,
    createContext: () => new AudioContext(),
    createInstrumentNode: (context) => new AudioWorkletNode(context, "everything-rings-instrument", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    }),
  };
}

export function SavedCaptureView({
  record,
  onBack,
  onShareDna,
}: {
  readonly record: ConsumerCaptureRecord;
  readonly onBack: () => void;
  readonly onShareDna: () => void;
}) {
  const controller = useRef<SavedCaptureAudioController | undefined>(undefined);
  const [playbackFailure, setPlaybackFailure] = useState<string>();

  function audio(): SavedCaptureAudioController {
    if (controller.current === undefined) {
      controller.current = new SavedCaptureAudioController(record.fingerprint, browserDependencies());
    }
    return controller.current;
  }

  function run(action: (player: SavedCaptureAudioController) => Promise<boolean>): void {
    setPlaybackFailure(undefined);
    void action(audio()).then((played) => {
      if (!played) setPlaybackFailure(playbackFailureCopy());
    }).catch(() => setPlaybackFailure(playbackFailureCopy()));
  }

  useEffect(() => {
    const handlePageHide = (): void => controller.current?.silence();
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") controller.current?.silence();
    };
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      controller.current?.dispose();
      controller.current = undefined;
    };
  }, []);

  return <main className="consumer-shell consumer-reveal saved-capture-view">
    <p className="consumer-mark">EVERYTHING RINGS</p>
    <section className="reveal-copy">
      <p className="consumer-kicker">SAVED CAPTURE</p>
      <h1>Play this discovery again.</h1>
      <p>This view reopens the fingerprint stored on this device. Every sound here is synthesized from its estimated resonances.</p>
    </section>

    <section className="saved-capture-truth" aria-label="Saved capture boundary">
      <strong>Original microphone audio was not retained.</strong>
      <p>The saved record contains the measured fingerprint only. It cannot replay the original strike or establish physical-object identity.</p>
    </section>

    <dl className="saved-capture-provenance" aria-label="Saved capture provenance">
      <div><dt>CAPTURED</dt><dd>{capturedAtLabel(record.capturedAt)}</dd></div>
      <div><dt>SIGNATURE</dt><dd><code>{record.signature}</code></dd></div>
      <div><dt>ALGORITHM</dt><dd><code>{record.fingerprint.algorithmVersion}</code></dd></div>
      <div><dt>SOFTWARE</dt><dd><code>{record.softwareRevision ?? "unstamped"}</code></dd></div>
    </dl>

    {playbackFailure !== undefined ? <p className="consumer-playback-error" role="alert">{playbackFailure}</p> : null}

    <ResonanceMicroscope
      fingerprint={record.fingerprint}
      onHearMode={(modeIndex) => run((player) => player.playMode(modeIndex))}
      onHearAll={() => run((player) => player.playModel())}
      captureUnavailableCopy="Original microphone audio was intentionally excluded from local history."
    />

    <PlayableKeyboard
      id="saved-capture-playable-keys"
      ariaLabel="Chromatic saved fingerprint keys"
      onNote={(midiNote) => run((player) => player.noteOn(midiNote))}
    />

    <div className="consumer-actions" aria-label="Saved capture actions">
      <button className="consumer-primary" onClick={onShareDna}>SHARE DNA</button>
      <button className="consumer-ghost" onClick={() => {
        controller.current?.silence();
        onBack();
      }}>BACK TO HISTORY</button>
    </div>
  </main>;
}
