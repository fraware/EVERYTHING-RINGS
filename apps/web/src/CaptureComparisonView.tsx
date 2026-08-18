import { useEffect, useRef, useState } from "react";
import { AcousticDnaView } from "./AcousticDnaView";
import {
  mutualNearestFrequencyPairs,
  summarizeCaptureObservation,
} from "./captureComparison";
import type { ConsumerCaptureRecord } from "./consumerHistory";
import { formatDecay, formatFrequency } from "./resonancePresentation";
import {
  SavedCaptureAudioController,
  type SavedCaptureAudioDependencies,
} from "./savedCaptureAudio";
import { playbackFailureCopy } from "./sessionErrors";
import instrumentWorkletUrl from "./instrument-processor.ts?worker&url";
import "./captureComparison.css";

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

function captureTime(capturedAt: string): string {
  const date = new Date(capturedAt);
  if (!Number.isFinite(date.getTime())) return capturedAt;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function optionalFrequency(value: number | undefined): string {
  return value === undefined ? "—" : formatFrequency(value);
}

function frequencySpan(low: number | undefined, high: number | undefined): string {
  if (low === undefined || high === undefined) return "—";
  return `${formatFrequency(low)} → ${formatFrequency(high)}`;
}

function ObservationHeader({
  label,
  record,
}: {
  readonly label: "A" | "B";
  readonly record: ConsumerCaptureRecord;
}) {
  return <header className="comparison-observation-head">
    <span>CAPTURE {label}</span>
    <strong>{record.fingerprint.modes.length} resonances</strong>
    <code>{record.signature}</code>
    <small>{captureTime(record.capturedAt)} · {record.fingerprint.algorithmVersion}</small>
  </header>;
}

export function CaptureComparisonView({
  left,
  right,
  onBack,
}: {
  readonly left: ConsumerCaptureRecord;
  readonly right: ConsumerCaptureRecord;
  readonly onBack: () => void;
}) {
  const leftAudio = useRef<SavedCaptureAudioController | undefined>(undefined);
  const rightAudio = useRef<SavedCaptureAudioController | undefined>(undefined);
  const [playbackFailure, setPlaybackFailure] = useState<string>();
  const leftSummary = summarizeCaptureObservation(left.fingerprint);
  const rightSummary = summarizeCaptureObservation(right.fingerprint);
  const pairs = mutualNearestFrequencyPairs(left.fingerprint, right.fingerprint);
  const algorithmMismatch = left.fingerprint.algorithmVersion !== right.fingerprint.algorithmVersion;

  function player(side: "left" | "right"): SavedCaptureAudioController {
    const target = side === "left" ? leftAudio : rightAudio;
    const fingerprint = side === "left" ? left.fingerprint : right.fingerprint;
    if (target.current === undefined) {
      target.current = new SavedCaptureAudioController(fingerprint, browserDependencies());
    }
    return target.current;
  }

  function silenceBoth(): void {
    leftAudio.current?.silence();
    rightAudio.current?.silence();
  }

  function hear(side: "left" | "right"): void {
    setPlaybackFailure(undefined);
    silenceBoth();
    void player(side).playModel().then((played) => {
      if (!played) setPlaybackFailure(playbackFailureCopy());
    }).catch(() => setPlaybackFailure(playbackFailureCopy()));
  }

  useEffect(() => {
    const silence = (): void => silenceBoth();
    const handleVisibility = (): void => {
      if (document.visibilityState === "hidden") silenceBoth();
    };
    window.addEventListener("pagehide", silence);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", silence);
      document.removeEventListener("visibilitychange", handleVisibility);
      leftAudio.current?.dispose();
      rightAudio.current?.dispose();
      leftAudio.current = undefined;
      rightAudio.current = undefined;
    };
  }, []);

  return <main className="consumer-shell comparison-view">
    <p className="consumer-mark">EVERYTHING RINGS</p>
    <section className="reveal-copy">
      <p className="consumer-kicker">RESONANCE DIFF</p>
      <h1>Compare two capture observations.</h1>
      <p>Inspect what each recorded transient produced. This view describes two saved fingerprints; it does not identify a physical object.</p>
    </section>

    <section className="comparison-boundary" aria-label="Comparison interpretation boundary">
      <strong>No identity verdict.</strong>
      <p>Equal signatures, close frequencies, or mutual-nearest pairs do not establish that two captures came from the same object. Differences do not establish that they came from different objects.</p>
    </section>

    {algorithmMismatch ? <p className="comparison-warning" role="alert">
      Fingerprint algorithm versions differ. Observed differences may reflect the analysis revision as well as the recorded transient.
    </p> : null}
    {playbackFailure !== undefined ? <p className="consumer-playback-error" role="alert">{playbackFailure}</p> : null}

    <section className="comparison-listen" aria-label="A B model listening">
      <button className="consumer-primary" onClick={() => hear("left")}>HEAR A MODEL</button>
      <span aria-hidden="true">A / B</span>
      <button className="consumer-primary" onClick={() => hear("right")}>HEAR B MODEL</button>
      <p>Fingerprint-derived reconstructions only. Original microphone audio is not stored in local history.</p>
    </section>

    <section className="comparison-dna-grid" aria-label="Side by side Acoustic DNA">
      <article>
        <ObservationHeader label="A" record={left} />
        <AcousticDnaView fingerprint={left.fingerprint} />
      </article>
      <article>
        <ObservationHeader label="B" record={right} />
        <AcousticDnaView fingerprint={right.fingerprint} />
      </article>
    </section>

    <section className="comparison-metrics" aria-labelledby="comparison-metrics-title">
      <div className="comparison-section-head">
        <p className="consumer-kicker">OBSERVED PROPERTIES</p>
        <h2 id="comparison-metrics-title">Two fingerprints, side by side.</h2>
      </div>
      <div className="comparison-metric-table" role="table" aria-label="Capture observation properties">
        <div className="comparison-metric-row comparison-metric-head" role="row"><span>PROPERTY</span><span>A</span><span>B</span></div>
        <div className="comparison-metric-row" role="row"><span>Resonance count</span><strong>{leftSummary.modeCount}</strong><strong>{rightSummary.modeCount}</strong></div>
        <div className="comparison-metric-row" role="row"><span>Frequency span</span><strong>{frequencySpan(leftSummary.lowestFrequencyHz, leftSummary.highestFrequencyHz)}</strong><strong>{frequencySpan(rightSummary.lowestFrequencyHz, rightSummary.highestFrequencyHz)}</strong></div>
        <div className="comparison-metric-row" role="row"><span>Strongest-at-strike mode</span><strong>{optionalFrequency(leftSummary.strongestFrequencyHz)}</strong><strong>{optionalFrequency(rightSummary.strongestFrequencyHz)}</strong></div>
        <div className="comparison-metric-row" role="row"><span>Longest fitted decay</span><strong>{leftSummary.longestDecaySeconds === undefined ? "—" : formatDecay(leftSummary.longestDecaySeconds)}</strong><strong>{rightSummary.longestDecaySeconds === undefined ? "—" : formatDecay(rightSummary.longestDecaySeconds)}</strong></div>
      </div>
    </section>

    <section className="comparison-pairs" aria-labelledby="comparison-pairs-title">
      <div className="comparison-section-head">
        <p className="consumer-kicker">MUTUAL-NEAREST FREQUENCIES</p>
        <h2 id="comparison-pairs-title">Reciprocal nearest neighbors in log frequency.</h2>
        <p>Threshold-free and one-to-one. Pairing is a navigation aid only; it does not assert a shared physical mode.</p>
      </div>
      {pairs.length === 0 ? <p className="consumer-tip">No reciprocal nearest-frequency pairs are available.</p> : <div className="comparison-pair-list">
        {pairs.slice(0, 10).map((pair) => <div className="comparison-pair" key={`${pair.leftModeIndex}-${pair.rightModeIndex}`}>
          <span>A{String(pair.leftModeIndex + 1).padStart(2, "0")}</span>
          <strong>{formatFrequency(pair.leftFrequencyHz)}</strong>
          <span aria-hidden="true">↔</span>
          <strong>{formatFrequency(pair.rightFrequencyHz)}</strong>
          <span>B{String(pair.rightModeIndex + 1).padStart(2, "0")}</span>
          <code>Δ {pair.distanceCents.toFixed(1)} cents</code>
        </div>)}
      </div>}
      {pairs.length > 10 ? <p className="consumer-tip">Showing 10 of {pairs.length} reciprocal nearest-frequency pairs.</p> : null}
    </section>

    <div className="consumer-actions comparison-actions">
      <button className="consumer-ghost" onClick={() => {
        silenceBoth();
        onBack();
      }}>BACK TO HISTORY</button>
    </div>
  </main>;
}
