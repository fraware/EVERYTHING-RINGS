import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { acousticDnaSourceModeIndices, encodeAcousticDna } from "./acoustic-dna";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatFrequency(frequencyHz: number): string {
  if (frequencyHz >= 1000) return `${(frequencyHz / 1000).toFixed(2)} kHz`;
  return `${Math.round(frequencyHz)} Hz`;
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function pcm16Wav(samples: Float32Array, sampleRate: number): Uint8Array {
  if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) {
    throw new RangeError("sampleRate must be finite and positive");
  }
  if (samples.length === 0) throw new RangeError("Acoustic Story audio must contain at least one sample");
  const bytesPerSample = 2;
  const dataBytes = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index] ?? 0));
    const quantized = value < 0 ? Math.round(value * 0x8000) : Math.round(value * 0x7fff);
    view.setInt16(44 + index * bytesPerSample, quantized, true);
  }
  return new Uint8Array(buffer);
}

function base64Encode(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const secondPresent = index + 1 < bytes.length;
    const thirdPresent = index + 2 < bytes.length;
    const second = secondPresent ? bytes[index + 1] ?? 0 : 0;
    const third = thirdPresent ? bytes[index + 2] ?? 0 : 0;
    const block = (first << 16) | (second << 8) | third;
    output += alphabet[(block >>> 18) & 63] ?? "";
    output += alphabet[(block >>> 12) & 63] ?? "";
    output += secondPresent ? alphabet[(block >>> 6) & 63] ?? "" : "=";
    output += thirdPresent ? alphabet[block & 63] ?? "" : "=";
  }
  return output;
}

export function createAcousticStoryHtml(
  fingerprint: AcousticFingerprintV1,
  renderedSamples: Float32Array,
  sampleRate: number,
): string {
  const dna = encodeAcousticDna(fingerprint);
  const sourceModeIndices = acousticDnaSourceModeIndices(fingerprint);
  const audioBase64 = base64Encode(pcm16Wav(renderedSamples, sampleRate));
  const durationSeconds = renderedSamples.length / sampleRate;
  const frequencies = fingerprint.modes.map((mode) => mode.frequencyHz);
  const frequencySpan = frequencies.length === 0
    ? "NO MEASURED MODES"
    : `${formatFrequency(Math.min(...frequencies))} — ${formatFrequency(Math.max(...frequencies))}`;
  const center = 540;
  const minimumRadius = 92;
  const radiusRange = 355;
  const rings = dna.modes.map((mode, index) => {
    const sourceModeIndex = sourceModeIndices[index];
    if (sourceModeIndex === undefined) return "";
    const source = fingerprint.modes[sourceModeIndex];
    if (source === undefined) return "";
    const radius = minimumRadius + mode.radius * radiusRange;
    const circumference = 2 * Math.PI * radius;
    const arcFraction = 0.12 + 0.86 * mode.persistence;
    const arcLength = circumference * arcFraction;
    const gapLength = Math.max(0.001, circumference - arcLength);
    const rotationDegrees = mode.angleRadians * 180 / Math.PI - 90;
    const strokeWidth = 2 + 13 * mode.intensity;
    const opacity = 0.2 + 0.8 * mode.intensity;
    return `<circle class="ring" cx="${center}" cy="${center}" r="${radius.toFixed(3)}" fill="none" stroke="#f3f3ec" stroke-linecap="round" stroke-width="${strokeWidth.toFixed(3)}" stroke-dasharray="${arcLength.toFixed(3)} ${gapLength.toFixed(3)}" opacity="${opacity.toFixed(3)}" transform="rotate(${rotationDegrees.toFixed(3)} ${center} ${center})" data-decay="${source.decaySeconds}" data-amplitude="${source.relativeAmplitude}" data-frequency="${source.frequencyHz}" data-base-opacity="${opacity.toFixed(6)}" data-base-width="${strokeWidth.toFixed(6)}"/>`;
  }).join("");
  const modeCount = fingerprint.modes.length;
  const modeLabel = `${modeCount} ${modeCount === 1 ? "RESONANCE" : "RESONANCES"}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>Everything Rings — Acoustic Story ${escapeHtml(dna.signature)}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#050505;color:#f3f3ec;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{display:grid;place-items:center;min-height:100vh}.story{position:relative;width:min(100vw,calc(100vh * .5625));min-height:min(100vh,177.7778vw);aspect-ratio:9/16;overflow:hidden;background:#0b0b0b;padding:4.6% 5.8%;display:flex;flex-direction:column}.top{display:flex;justify-content:space-between;align-items:center;color:#777771;font-size:clamp(8px,1.7vw,16px);letter-spacing:.18em}.top code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em}.headline{margin:6.5% 0 0;font-size:clamp(30px,8.2vw,82px);line-height:.9;letter-spacing:-.06em;font-weight:500}.sub{margin:3.5% 0 0;color:#888881;font-size:clamp(10px,2.6vw,24px);line-height:1.45}.dna{display:block;width:100%;margin:auto 0}.boundary{fill:none;stroke:#f3f3ec;stroke-width:1;opacity:.1}.core{fill:#f3f3ec}.ring{transition:opacity 35ms linear,stroke-width 35ms linear}.readout{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:#292925;border:1px solid #292925}.readout>div{min-width:0;padding:3.4%;background:#0b0b0b;display:grid;gap:7px}.readout span{color:#65655f;font-size:clamp(7px,1.5vw,13px);letter-spacing:.11em}.readout strong{overflow:hidden;text-overflow:ellipsis;font-size:clamp(13px,3.2vw,28px);font-weight:450;font-variant-numeric:tabular-nums}.play{margin-top:4%;width:100%;border:1px solid #f3f3ec;background:#f3f3ec;color:#0b0b0b;padding:4.3%;font:inherit;font-size:clamp(10px,2.2vw,20px);letter-spacing:.12em;cursor:pointer}.footer{display:flex;justify-content:space-between;gap:16px;margin-top:3.2%;color:#5f5f5a;font-size:clamp(7px,1.5vw,13px);line-height:1.4}.footer code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.progress{height:1px;background:#292925;margin-top:3.2%;overflow:hidden}.progress>div{width:0;height:100%;background:#f3f3ec}.model-only{position:absolute;right:5.8%;top:11%;color:#5d5d58;font-size:clamp(7px,1.4vw,12px);letter-spacing:.12em;writing-mode:vertical-rl}@media (prefers-reduced-motion:reduce){.ring{transition:none}}
</style>
</head>
<body>
<main class="story">
<div class="top"><span>EVERYTHING RINGS</span><code>${escapeHtml(fingerprint.algorithmVersion)}</code></div>
<h1 class="headline">YOU FOUND<br/>${modeLabel}.</h1>
<p class="sub">${escapeHtml(frequencySpan)} · drag nothing, just press play and watch the fitted ringdown unfold.</p>
<span class="model-only">MODEL ONLY · NO RECORDED AUDIO</span>
<svg class="dna" viewBox="0 0 1080 1080" role="img" aria-label="Animated Acoustic DNA ${escapeHtml(dna.signature)}">
<circle class="boundary" cx="${center}" cy="${center}" r="${minimumRadius + radiusRange}"/>
<circle class="core" cx="${center}" cy="${center}" r="5"/>
${rings}
</svg>
<div class="readout"><div><span>TIME</span><strong id="time">+0.00 s</strong></div><div><span>MODELED DOMINANT</span><strong id="dominant">—</strong></div><div><span>≥10% ENVELOPE</span><strong id="active">${modeCount} / ${modeCount}</strong></div></div>
<div class="progress"><div id="progress"></div></div>
<button class="play" id="play" type="button">PLAY THIS OBJECT</button>
<div class="footer"><code>${escapeHtml(dna.signature)}</code><span>Estimated audible resonances from one recorded transient.</span></div>
<audio id="audio" preload="auto" src="data:audio/wav;base64,${audioBase64}"></audio>
</main>
<script>
(() => {
  const duration = ${durationSeconds.toFixed(9)};
  const threshold = 0.1;
  const audio = document.getElementById("audio");
  const play = document.getElementById("play");
  const time = document.getElementById("time");
  const dominant = document.getElementById("dominant");
  const active = document.getElementById("active");
  const progress = document.getElementById("progress");
  const rings = Array.from(document.querySelectorAll(".ring"));
  let frame = 0;
  const formatFrequency = (hz) => hz >= 1000 ? (hz / 1000).toFixed(2) + " kHz" : Math.round(hz) + " Hz";
  const render = (elapsed) => {
    let dominantStrength = -Infinity;
    let dominantFrequency = null;
    let activeCount = 0;
    rings.forEach((ring) => {
      const decay = Number(ring.dataset.decay);
      const amplitude = Number(ring.dataset.amplitude);
      const frequency = Number(ring.dataset.frequency);
      const baseOpacity = Number(ring.dataset.baseOpacity);
      const baseWidth = Number(ring.dataset.baseWidth);
      const envelope = Math.exp(-elapsed / decay);
      const strength = amplitude * envelope;
      if (envelope >= threshold) activeCount += 1;
      if (strength > dominantStrength) {
        dominantStrength = strength;
        dominantFrequency = frequency;
      }
      ring.style.opacity = String(Math.max(0.035, baseOpacity * envelope));
      ring.style.strokeWidth = String(Math.max(0.8, baseWidth * (0.28 + 0.72 * envelope)));
    });
    time.textContent = "+" + elapsed.toFixed(2) + " s";
    dominant.textContent = dominantFrequency === null ? "—" : formatFrequency(dominantFrequency);
    active.textContent = activeCount + " / " + rings.length;
    progress.style.width = Math.min(100, duration > 0 ? elapsed / duration * 100 : 0).toFixed(3) + "%";
  };
  const advance = () => {
    render(Math.min(duration, audio.currentTime));
    if (!audio.paused && !audio.ended) frame = requestAnimationFrame(advance);
  };
  play.addEventListener("click", async () => {
    cancelAnimationFrame(frame);
    audio.currentTime = 0;
    render(0);
    try {
      await audio.play();
      play.textContent = "REPLAY THIS OBJECT";
      frame = requestAnimationFrame(advance);
    } catch {
      play.textContent = "TAP AGAIN TO PLAY";
    }
  });
  audio.addEventListener("ended", () => {
    cancelAnimationFrame(frame);
    render(duration);
  });
  render(0);
})();
</script>
</body>
</html>`;
}
