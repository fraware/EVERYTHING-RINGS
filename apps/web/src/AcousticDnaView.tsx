import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { DEFAULT_ACOUSTIC_DNA_CONFIG, encodeAcousticDna } from "@everything-rings/visual";

interface AcousticDnaViewProps {
  readonly fingerprint: AcousticFingerprintV1;
  readonly selectedModeIndex?: number;
  readonly onSelectMode?: (modeIndex: number) => void;
}

export function AcousticDnaView({ fingerprint, selectedModeIndex, onSelectMode }: AcousticDnaViewProps) {
  const dna = encodeAcousticDna(fingerprint);
  const sourceModeIndices = fingerprint.modes
    .map((mode, index) => ({ mode, index }))
    .filter(({ mode }) => mode.frequencyHz > 0 && Number.isFinite(mode.frequencyHz))
    .sort((left, right) => left.mode.frequencyHz - right.mode.frequencyHz)
    .slice(0, DEFAULT_ACOUSTIC_DNA_CONFIG.maximumModes)
    .map(({ index }) => index);
  const center = 160;
  const minimumRadius = 28;
  const radiusRange = 112;
  const interactive = onSelectMode !== undefined;

  return (
    <figure className={`dna-view${interactive ? " dna-view-interactive" : ""}`}>
      <svg viewBox="0 0 320 320" role={interactive ? "group" : "img"} aria-label={`Acoustic DNA ${dna.signature}`}>
        <circle className="dna-boundary" cx={center} cy={center} r={radiusRange + minimumRadius} />
        <circle className="dna-core" cx={center} cy={center} r={3} />
        {dna.modes.map((mode, index) => {
          const sourceModeIndex = sourceModeIndices[index];
          if (sourceModeIndex === undefined) return null;
          const radius = minimumRadius + mode.radius * radiusRange;
          const circumference = 2 * Math.PI * radius;
          const arcFraction = 0.12 + 0.86 * mode.persistence;
          const arcLength = circumference * arcFraction;
          const gapLength = Math.max(0.001, circumference - arcLength);
          const rotationDegrees = mode.angleRadians * 180 / Math.PI - 90;
          const selected = selectedModeIndex === sourceModeIndex;
          return (
            <circle
              className={`dna-ring${interactive ? " dna-ring-interactive" : ""}${selected ? " dna-ring-selected" : ""}`}
              key={`${mode.frequencyHz}-${sourceModeIndex}`}
              cx={center}
              cy={center}
              r={radius}
              strokeDasharray={`${arcLength} ${gapLength}`}
              strokeWidth={0.8 + 4.2 * mode.intensity}
              opacity={selected ? 1 : 0.18 + 0.8 * mode.intensity}
              transform={`rotate(${rotationDegrees} ${center} ${center})`}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={interactive ? `Select resonance ${sourceModeIndex + 1}, ${Math.round(mode.frequencyHz)} hertz` : undefined}
              aria-pressed={interactive ? selected : undefined}
              onClick={interactive ? () => onSelectMode(sourceModeIndex) : undefined}
              onKeyDown={interactive ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectMode(sourceModeIndex);
                }
              } : undefined}
            />
          );
        })}
      </svg>
      <figcaption>
        <span>ACOUSTIC DNA / V1</span>
        <code>{dna.signature}</code>
        {interactive ? <span>SELECT A RING TO INSPECT IT</span> : null}
      </figcaption>
    </figure>
  );
}
