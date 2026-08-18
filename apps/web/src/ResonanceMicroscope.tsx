import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { useState } from "react";
import { AcousticDnaView } from "./AcousticDnaView";
import {
  formatConfidence,
  formatDecay,
  formatFrequency,
  formatRelativeLevel,
  summarizeResonances,
} from "./resonancePresentation";

interface ResonanceMicroscopeProps {
  readonly fingerprint: AcousticFingerprintV1;
  readonly onHearMode: (modeIndex: number) => void;
  readonly onHearAll: () => void;
}

function modeOrdinal(index: number, count: number): string {
  return `MODE ${String(index + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`;
}

export function ResonanceMicroscope({ fingerprint, onHearMode, onHearAll }: ResonanceMicroscopeProps) {
  const summary = summarizeResonances(fingerprint);
  const [selectedModeIndex, setSelectedModeIndex] = useState(summary?.strongestModeIndex ?? 0);
  const selectedMode = fingerprint.modes[selectedModeIndex];

  if (selectedMode === undefined || summary === undefined) return null;

  return <section className="resonance-microscope" aria-labelledby="resonance-microscope-title">
    <div className="microscope-heading">
      <div>
        <p className="consumer-kicker">RESONANCE MICROSCOPE</p>
        <h2 id="resonance-microscope-title">Touch a ring. Hear it alone.</h2>
      </div>
      <p className="microscope-span">{formatFrequency(summary.lowestFrequencyHz)} → {formatFrequency(summary.highestFrequencyHz)}</p>
    </div>

    <div className="microscope-grid">
      <AcousticDnaView
        fingerprint={fingerprint}
        selectedModeIndex={selectedModeIndex}
        onSelectMode={setSelectedModeIndex}
      />

      <article className="mode-inspector" aria-live="polite">
        <div className="mode-inspector-head">
          <p>{modeOrdinal(selectedModeIndex, fingerprint.modes.length)}</p>
          <div className="mode-flags">
            {selectedModeIndex === summary.strongestModeIndex ? <span>STRONGEST</span> : null}
            {selectedModeIndex === summary.longestModeIndex ? <span>LONGEST RING</span> : null}
          </div>
        </div>

        <strong className="mode-frequency">{formatFrequency(selectedMode.frequencyHz)}</strong>
        <div className="mode-primary-metrics">
          <div><span>DECAY τ</span><strong>{formatDecay(selectedMode.decaySeconds)}</strong></div>
          <div><span>Q</span><strong>{Math.round(selectedMode.q)}</strong></div>
          <div><span>CONFIDENCE</span><strong>{formatConfidence(selectedMode.confidence)}</strong></div>
        </div>

        <div className="mode-audition-actions">
          <button className="consumer-primary" onClick={() => onHearMode(selectedModeIndex)}>HEAR THIS RING</button>
          <button className="consumer-ghost" onClick={onHearAll}>HEAR ALL</button>
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

    <p className="microscope-note">Each entry is one audible resonance estimated from this recorded transient. The microscope exposes the measured fingerprint; it does not infer material identity or complete structural modes.</p>
  </section>;
}
