import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AcousticDnaView } from "./AcousticDnaView";

function mode(frequencyHz: number, amplitude: number): AcousticMode {
  return {
    frequencyHz,
    relativeAmplitude: amplitude,
    decaySeconds: 0.7,
    q: 200,
    confidence: 0.9,
    diagnostics: {
      prominenceDb: 20,
      persistenceSeconds: 0.4,
      frequencyStdCents: 2,
      decayFitScore: 0.95,
      observationCount: 20,
    },
  };
}

const FINGERPRINT: AcousticFingerprintV1 = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48_000,
  durationSeconds: 2,
  modes: [mode(1320, 0.5), mode(440, 1), mode(2860, 0.2)],
};

describe("interactive Acoustic DNA", () => {
  it("keeps frequency-sorted visual rings bound to their original fingerprint indices", () => {
    const markup = renderToStaticMarkup(
      <AcousticDnaView fingerprint={FINGERPRINT} selectedModeIndex={0} onSelectMode={() => undefined} />,
    );

    expect(markup).toContain('role="group"');
    expect(markup).toContain('role="button"');

    const low = markup.indexOf("Select resonance 2, 440 hertz");
    const middle = markup.indexOf("Select resonance 1, 1320 hertz");
    const high = markup.indexOf("Select resonance 3, 2860 hertz");
    expect(low).toBeGreaterThan(-1);
    expect(middle).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(middle);

    const selected = markup.slice(middle, high);
    expect(selected).toContain('aria-pressed="true"');
  });
});
