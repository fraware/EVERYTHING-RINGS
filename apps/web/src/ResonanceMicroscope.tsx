import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { useEffect, useRef, useState } from "react";
import { AcousticDnaView } from "./AcousticDnaView";
import "./resonanceMicroscope.css";
import {
  formatConfidence,
  formatDecay,
  formatFrequency,
  formatRelativeLevel,
  summarizeResonances,
} from "./resonancePresentation";
import {
  animationElapsedSeconds,
  RINGDOWN_VISIBLE_ENVELOPE_FRACTION,
  summarizeRingdownAtTime,
} from "./ringdownPresentation";

interface ResonanceMicroscopeProps {
  readonly fingerprint: AcousticFingerprintV1;
  readonly onHearMode: (modeIndex: number) => void;
  readonly onHearAll: () => void;
  readonly onHearCapture?: () => void;
  readonly captureUnavailableCopy?: string;
}

function modeOrdinal(index: number, count: number): string {
  return `MODE ${String(index + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`;
}

function formatElapsedSeconds(elapsedSeconds: number): string {
  return `+${elapsedSeconds.toFixed(2)} s`;
}

export function ResonanceMicroscope({
  fingerprint,
  onHearMode,
  onHearAll,
  onHearCapture,
  captureUnavailableCopy,
}: ResonanceMicroscopeProps) {
  const summary = summarizeResonances(fingerprint);
  const [selectedModeIndex, setSelectedModeIndex] = useState(summary?.strongestModeIndex ?? 0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const animationFrame = useRef<number | undefined>(undefined);
  const selectedMode = fingerprint.modes[selectedModeIndex];
  const ringdown = summarizeRingdownAtTime(fingerprint, elapsedSeconds);
  const maximumElapsedSeconds = Math.max(0.1, fingerprint.durationSeconds);
  const captureAvailable = onHearCapture !== undefined;

  function stopAnimation(): void {
    if (animationFrame.current !== undefined) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = undefined;
    }
  }

  function watchModel(): void {
    stopAnimation();
    setElapsedSeconds(0);
    onHearAll();
    const startedAtMs = performance.now();
    const advance = (frameTimestampMs: number): void => {
      const nextElapsedSeconds = animationElapsedSeconds(
        startedAtMs,
        frameTimestampMs,
        maximumElapsedSeconds,
      );
      setElapsedSeconds(nextElapsedSeconds);
      if (nextElapsedSeconds < maximumElapsedSeconds) {
        animationFrame.current = requestAnimationFrame(advance);
      } else {
        animationFrame.current = undefined;
      }
    };
    animationFrame.current = requestAnimationFrame(advance);
  }

  useEffect(() => () => stopAnimation(), []);

  if (selectedMode === undefined || summary === undefined || ringdown === undefined) return null;
  const dominantMode = fingerprint.modes[ringdown.dominantModeIndex];
  const selectedEnvelopeFraction = ringdown.envelopeFractions[selectedModeIndex] ?? 0;

  return <section className="resonance-microscope" aria-labelledby="resonance-microscope-title">
    <div className="microscope-heading">
      <div>
        <p className="consumer-kicker">RESONANCE MICROSCOPE</p>
        <h2 id="resonance-microscope-title">Drag through the ringdown.</h2>
      </div>
      <p className="microscope-span">{formatFrequency(summary.lowestFrequencyHz)} → {formatFrequency(summary.highestFrequencyHz)}</p>
    </div>

    <section className="listening-compare" aria-label="Capture and reconstruction comparison">
      <div className="listening-source">
        <span>CAPTURE</span>
        <strong>{captureAvailable ? "Analyzed microphone ringdown" : "Original capture unavailable"}</strong>
        <p>{captureAvailable
          ? "Same deterministic isolation used for analysis; gain-only peak matched."
          : (captureUnavailableCopy ?? "The original microphone recording is not available in this view.")}</p>
      </div>
      <button className="consumer-ghost" disabled={!captureAvailable} onClick={onHearCapture}>
        {captureAvailable ? "HEAR CAPTURE" : "CAPTURE NOT STORED"}
      </button>
      <div className="listening-divider" aria-hidden="true">↔</div>
      <div className="listening-source">
        <span>MODEL</span>
        <strong>Measured-mode reconstruction</strong>
        <p>Estimated resonances synthesized without recorded audio.</p>
      </div>
      <button className="consumer-primary" onClick={watchModel}>WATCH + HEAR MODEL</button>
    </section>

    <div className="ringdown-control">
      <div className="ringdown-control-head">
        <span>FITTED RINGDOWN</span>
        <strong>{formatElapsedSeconds(elapsedSeconds)}</strong>
      </div>
      <input
        className="ringdown-slider"
        type="range"
        min={0}
        max={maximumElapsedSeconds}
        step={0.01}
        value={elapsedSeconds}
        aria-label="Elapsed ringdown time"
        onChange={(event) => {
          stopAnimation();
          setElapsedSeconds(Number(event.currentTarget.value));
        }}
      />
      <div className="ringdown-scale"><span>STRIKE</span><span>{formatElapsedSeconds(maximumElapsedSeconds)}</span></div>
      <div className="ringdown-readout">
        <div><span>MODELED DOMINANT</span><strong>{dominantMode === undefined ? "—" : formatFrequency(dominantMode.frequencyHz)}</strong></div>
        <div><span>≥ {Math.round(RINGDOWN_VISIBLE_ENVELOPE_FRACTION * 100)}% ENVELOPE</span><strong>{ringdown.modesAboveVisibleEnvelope} / {fingerprint.modes.length}</strong></div>
        <div><span>SELECTED ENVELOPE</span><strong>{formatConfidence(selectedEnvelopeFraction)}</strong></div>
      </div>
    </div>

    <div className="microscope-grid">
      <AcousticDnaView
        fingerprint={fingerprint}
        selectedModeIndex={selectedModeIndex}
        onSelectMode={setSelectedModeIndex}
        elapsedSeconds={elapsedSeconds}
      />

      <article className="mode-inspector" aria-live="polite">
        <div className="mode-inspector-head">
          <p>{modeOrdinal(selectedModeIndex, fingerprint.modes.length)}</p>
          <div className="mode-flags">
            {selectedModeIndex === summary.strongestModeIndex ? <span>STRONGEST AT STRIKE</span> : null}
            {selectedModeIndex === summary.longestModeIndex ? <span>LONGEST RING</span> : null}
            {selectedModeIndex === ringdown.dominantModeIndex ? <span>DOMINANT NOW</span> : null}
          </div>
        </div>

        <strong className="mode-frequency">{formatFrequency(selectedMode.frequencyHz)}</strong>
        <p className="mode-envelope-now">{formatConfidence(selectedEnvelopeFraction)} of its fitted initial envelope at {formatElapsedSeconds(elapsedSeconds)}</p>
        <div className="mode-primary-metrics">
          <div><span>DECAY τ</span><strong>{formatDecay(selectedMode.decaySeconds)}</strong></div>
          <div><span>Q</span><strong>{Math.round(selectedMode.q)}</strong></div>
          <div><span>CONFIDENCE</span><strong>{formatConfidence(selectedMode.confidence)}</strong></div>
        </div>

        <div className="mode-audition-actions">
          <button className="consumer-primary" onClick={() => onHearMode(selectedModeIndex)}>HEAR THIS RING</button>
          <button className="consumer-ghost" onClick={onHearAll}>HEAR MODEL</button>
        </div>

        <dl className="mode-diagnostics">
          <div><dt>Relative level</dt><dd>{formatRelativeLevel(selectedMode.relativeAmplitude)}</dd></div>
          <div><dt>Prominence</dt><dd>{selectedMode.diagnostics.prominenceDb.toFixed(1)} dB</dd></div>
          <div><dt>Persistence</dt><dd>{formatDecay(selectedMode.diagnostics.persistenceSeconds)}</dd></div>
          <div><dt>Frequency spread</dt><dd>{selectedMode.diagnostics.frequencyStdCents.toFixed(1)} cents</dd></div>
          <div><dt>Decay fit</dt><dd>{formatConfidence(selectedMode.diagnostics.decayFitScore)}</dd></div>
          <div><dt>Observations</dt><dd>{selectedMode.diagnostics.observationCount}</dd></div>
        </dl>
      </article>
    </div>

    <div className="mode-strip" aria-label="Measured resonances">
      {fingerprint.modes.map((mode, index) => <button
        className={index === selectedModeIndex ? "mode-chip mode-chip-selected" : "mode-chip"}
        key={`${mode.frequencyHz}-${index}`}
        aria-pressed={index === selectedModeIndex}
        onClick={() => setSelectedModeIndex(index)}
      >
        <span>{String(index + 1).padStart(2, "0")}</span>
        <strong>{formatFrequency(mode.frequencyHz)}</strong>
      </button>)}
    </div>

    <p className="microscope-note">The scrubber visualizes each mode’s fitted exponential amplitude envelope. A faint trace remains so every measured mode stays selectable. The model contains synthesized estimated modes only.</p>
  </section>;
}
