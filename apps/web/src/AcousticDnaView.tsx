import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { encodeAcousticDna } from "@everything-rings/visual";

export function AcousticDnaView({ fingerprint }: { readonly fingerprint: AcousticFingerprintV1 }) {
  const dna = encodeAcousticDna(fingerprint);
  const center = 160;
  const minimumRadius = 28;
  const radiusRange = 112;

  return (
    <figure className="dna-view">
      <svg viewBox="0 0 320 320" role="img" aria-label={`Acoustic DNA ${dna.signature}`}>
        <circle className="dna-boundary" cx={center} cy={center} r={radiusRange + minimumRadius} />
        <circle className="dna-core" cx={center} cy={center} r={3} />
        {dna.modes.map((mode, index) => {
          const radius = minimumRadius + mode.radius * radiusRange;
          const circumference = 2 * Math.PI * radius;
          const arcFraction = 0.12 + 0.86 * mode.persistence;
          const arcLength = circumference * arcFraction;
          const gapLength = Math.max(0.001, circumference - arcLength);
          const rotationDegrees = mode.angleRadians * 180 / Math.PI - 90;
          return (
            <circle
              className="dna-ring"
              key={`${mode.frequencyHz}-${index}`}
              cx={center}
              cy={center}
              r={radius}
              strokeDasharray={`${arcLength} ${gapLength}`}
              strokeWidth={0.8 + 4.2 * mode.intensity}
              opacity={0.18 + 0.8 * mode.intensity}
              transform={`rotate(${rotationDegrees} ${center} ${center})`}
            />
          );
        })}
      </svg>
      <figcaption>
        <span>ACOUSTIC DNA / V1</span>
        <code>{dna.signature}</code>
      </figcaption>
    </figure>
  );
}
