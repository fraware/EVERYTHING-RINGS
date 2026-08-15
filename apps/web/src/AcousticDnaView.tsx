import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { encodeAcousticDna } from "@everything-rings/visual";
import type { KeyboardEvent } from "react";

export interface AcousticDnaViewProps {
  readonly fingerprint: AcousticFingerprintV1;
  readonly onModeActivate?: (modeIndex: number) => void;
  readonly selectedModeIndex?: number;
}

export function AcousticDnaView({ fingerprint, onModeActivate, selectedModeIndex }: AcousticDnaViewProps) {
  const dna = encodeAcousticDna(fingerprint);
  const center = 160;
  const minimumRadius = 28;
  const radiusRange = 112;
  const interactive = onModeActivate !== undefined;

  function activateFromKeyboard(event: KeyboardEvent<SVGCircleElement>, modeIndex: number): void {
    if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onModeActivate?.(modeIndex);
  }

  return (
    <figure className="dna-view">
      <svg viewBox="0 0 320 320" role={interactive ? "group" : "img"} aria-label={`Acoustic DNA ${dna.signature}`}>
        <circle className="dna-boundary" cx={center} cy={center} r={radiusRange + minimumRadius} />
        <circle className="dna-core" cx={center} cy={center} r={3} />
        {dna.modes.map((mode, index) => {
          const radius = minimumRadius + mode.radius * radiusRange;
          const circumference = 2 * Math.PI * radius;
          const arcFraction = 0.12 + 0.86 * mode.persistence;
          const arcLength = circumference * arcFraction;
          const gapLength = Math.max(0.001, circumference - arcLength);
          const rotationDegrees = mode.angleRadians * 180 / Math.PI - 90;
          const selected = selectedModeIndex === index;
          return (
            <circle
              className={`dna-ring${interactive ? " dna-ring-interactive" : ""}${selected ? " dna-ring-selected" : ""}`}
              key={`${mode.frequencyHz}-${index}`}
              cx={center}
              cy={center}
              r={radius}
              strokeDasharray={`${arcLength} ${gapLength}`}
              strokeWidth={(0.8 + 4.2 * mode.intensity) * (selected ? 1.45 : 1)}
              opacity={selected ? 1 : 0.18 + 0.8 * mode.intensity}
              transform={`rotate(${rotationDegrees} ${center} ${center})`}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={interactive ? `Solo estimated resonance ${mode.frequencyHz.toFixed(1)} hertz` : undefined}
              aria-pressed={interactive ? selected : undefined}
              data-mode-index={interactive ? index : undefined}
              onClick={interactive ? () => onModeActivate(index) : undefined}
              onKeyDown={interactive ? (event) => activateFromKeyboard(event, index) : undefined}
            />
          );
        })}
      </svg>
      <figcaption>
        <span>ACOUSTIC DNA / V1</span>
        <code>{dna.signature}</code>
        {interactive ? <span>TAP OR FOCUS A RING TO HEAR THAT ESTIMATED RESONANCE ALONE</span> : null}
      </figcaption>
    </figure>
  );
}
