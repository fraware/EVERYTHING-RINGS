import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { encodeAcousticDna } from "./acoustic-dna";

function formatFrequency(frequencyHz: number): string {
  if (frequencyHz >= 1000) return `${(frequencyHz / 1000).toFixed(2)} kHz`;
  return `${Math.round(frequencyHz)} Hz`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function createAcousticCardSvg(fingerprint: AcousticFingerprintV1): string {
  const dna = encodeAcousticDna(fingerprint);
  const centerX = 540;
  const centerY = 535;
  const minimumRadius = 80;
  const radiusRange = 305;
  const frequencies = fingerprint.modes.map((mode) => mode.frequencyHz);
  const frequencySpan = frequencies.length === 0
    ? "NO MEASURED MODES"
    : `${formatFrequency(Math.min(...frequencies))} — ${formatFrequency(Math.max(...frequencies))}`;
  const modeCount = fingerprint.modes.length;
  const modeLabel = `${modeCount} ${modeCount === 1 ? "RESONANCE" : "RESONANCES"}`;

  const rings = dna.modes.map((mode) => {
    const radius = minimumRadius + mode.radius * radiusRange;
    const circumference = 2 * Math.PI * radius;
    const arcFraction = 0.12 + 0.86 * mode.persistence;
    const arcLength = circumference * arcFraction;
    const gapLength = Math.max(0.001, circumference - arcLength);
    const rotationDegrees = mode.angleRadians * 180 / Math.PI - 90;
    const strokeWidth = 2 + 11 * mode.intensity;
    const opacity = 0.22 + 0.78 * mode.intensity;
    return `<circle cx="${centerX}" cy="${centerY}" r="${radius.toFixed(3)}" fill="none" stroke="#f0f0e9" stroke-linecap="round" stroke-width="${strokeWidth.toFixed(3)}" stroke-dasharray="${arcLength.toFixed(3)} ${gapLength.toFixed(3)}" opacity="${opacity.toFixed(3)}" transform="rotate(${rotationDegrees.toFixed(3)} ${centerX} ${centerY})"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-label="Everything Rings Acoustic DNA ${escapeXml(dna.signature)}">
<rect width="1080" height="1350" fill="#0b0b0b"/>
<text x="72" y="84" fill="#777771" font-family="Arial, Helvetica, sans-serif" font-size="20" letter-spacing="5">EVERYTHING RINGS</text>
<text x="72" y="142" fill="#f0f0e9" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="500" letter-spacing="-1">ACOUSTIC DNA</text>
<text x="1008" y="84" fill="#777771" font-family="monospace" font-size="18" text-anchor="end">V1</text>
<circle cx="${centerX}" cy="${centerY}" r="${minimumRadius + radiusRange}" fill="none" stroke="#f0f0e9" stroke-width="1" opacity="0.12"/>
<circle cx="${centerX}" cy="${centerY}" r="5" fill="#f0f0e9"/>
${rings}
<line x1="72" y1="1000" x2="1008" y2="1000" stroke="#292925"/>
<text x="72" y="1076" fill="#f0f0e9" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="500" letter-spacing="-3">${modeLabel}</text>
<text x="72" y="1130" fill="#8d8d86" font-family="Arial, Helvetica, sans-serif" font-size="24">${frequencySpan}</text>
<text x="72" y="1212" fill="#777771" font-family="monospace" font-size="19">${escapeXml(dna.signature)}</text>
<text x="1008" y="1212" fill="#777771" font-family="monospace" font-size="19" text-anchor="end">${escapeXml(fingerprint.algorithmVersion)}</text>
<text x="72" y="1280" fill="#5f5f5a" font-family="Arial, Helvetica, sans-serif" font-size="17">Estimated audible resonances from one recorded transient.</text>
</svg>`;
}
