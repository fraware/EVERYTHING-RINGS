import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { useEffect, useRef, useState } from "react";
import { AcousticDnaView } from "./AcousticDnaView";
import { PlayableKeyboard } from "./PlayableKeyboard";
import {
  SavedCaptureAudioController,
  type SavedCaptureAudioDependencies,
} from "./savedCaptureAudio";
import { playbackFailureCopy } from "./sessionErrors";
import instrumentWorkletUrl from "./instrument-processor.ts?worker&url";
import "./acousticCapsule.css";

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

function frequencyRange(fingerprint: AcousticFingerprintV1): string {
  const ordered = [...fingerprint.modes].sort((left, right) => left.frequencyHz - right.frequencyHz);
  const low = ordered.at(0)?.frequencyHz;
  const high = ordered.at(-1)?.frequencyHz;
  if (low === undefined || high === undefined) return "—";
  return `${Math.round(low)}–${Math.round(high)} Hz`;
}

export function SharedCaptureView({
  fingerprint,
  signature,
  status,
  onShareAgain,
  onTryOwn,
}: {
  readonly fingerprint: AcousticFingerprintV1;
  readonly signature: string;
  readonly status?: string | undefined;
  readonly onShareAgain: () => void;
  readonly onTryOwn: () => void;
}) {
  const controller = useRef<SavedCaptureAudioController | undefined>(undefined);
  const [playbackFailure, setPlaybackFailure] = useState<string>();
  const [showKeyboard, setShowKeyboard] = useState(false);

  function audio(): SavedCaptureAudioController {
    if (controller.current === undefined) {
      controller.current = new SavedCaptureAudioController(fingerprint, browserDependencies());
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
    controller.current?.dispose();
    controller.current = undefined;
    setPlaybackFailure(undefined);
    setShowKeyboard(false);
  }, [fingerprint]);

  useEffect(() => {
    const silence = (): void => controller.current?.silence();
    const handleVisibility = (): void => {
      if (document.visibilityState === "hidden") silence();
    };
    window.addEventListener("pagehide", silence);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", silence);
      document.removeEventListener("visibilitychange", handleVisibility);
      controller.current?.dispose();
      controller.current = undefined;
    };
  }, []);

  return <main className="consumer-shell shared-capsule-view">
    <p className="consumer-mark">EVERYTHING RINGS</p>

    <section className="shared-capsule-hero">
      <p className="consumer-kicker">SHARED RING</p>
      <h1>Hear what they found.</h1>
      <p>This link contains {fingerprint.modes.length} estimated resonances as a fingerprint you can hear and play.</p>
    </section>

    <AcousticDnaView fingerprint={fingerprint} />

    {playbackFailure !== undefined ? <p className="consumer-playback-error" role="alert">{playbackFailure}</p> : null}
    {status !== undefined ? <p className="consumer-history-status" role="status">{status}</p> : null}

    <section className="shared-capsule-listen" aria-label="Shared ring playback">
      <button className="consumer-primary shared-capsule-hear" onClick={() => run((player) => player.playModel())}>HEAR THIS RING</button>
      <button
        className="consumer-ghost"
        aria-expanded={showKeyboard}
        aria-controls="shared-capsule-playable-keys"
        onClick={() => {
          controller.current?.silence();
          setShowKeyboard((value) => !value);
        }}
      >{showKeyboard ? "HIDE KEYS" : "PLAY IT"}</button>
    </section>

    {showKeyboard ? <PlayableKeyboard
      id="shared-capsule-playable-keys"
      ariaLabel="Chromatic shared fingerprint keys"
      onNote={(midiNote) => run((player) => player.noteOn(midiNote))}
    /> : null}

    <section className="shared-capsule-facts" aria-label="Shared fingerprint summary">
      <div><span>RESONANCES</span><strong>{fingerprint.modes.length}</strong></div>
      <div><span>RANGE</span><strong>{frequencyRange(fingerprint)}</strong></div>
      <div><span>ALGORITHM</span><strong><code>{fingerprint.algorithmVersion}</code></strong></div>
      <div className="shared-capsule-signature"><span>ACOUSTIC DNA</span><strong><code>{signature}</code></strong></div>
    </section>

    <section className="shared-capsule-boundary" aria-label="Shared ring interpretation boundary">
      <strong>A fingerprint, not the original recording.</strong>
      <p>The link carries estimated resonance data only. Playback is synthesized locally; microphone audio is absent. The signature describes this fingerprint and does not identify a physical object. A capsule is shareable data, not authenticated capture provenance.</p>
    </section>

    <section className="shared-capsule-handoff" aria-label="Shared ring actions">
      <div>
        <p className="consumer-kicker">NOW TRY YOUR WORLD</p>
        <h2>What around you rings?</h2>
        <p className="shared-capsule-handoff-copy">One tap starts listening. Your microphone stays on this device.</p>
      </div>
      <div className="consumer-actions">
        <button className="consumer-primary" onClick={() => {
          controller.current?.silence();
          onTryOwn();
        }}>TRY YOUR OWN</button>
        <button className="consumer-ghost" onClick={onShareAgain}>SHARE AGAIN</button>
      </div>
    </section>
  </main>;
}
