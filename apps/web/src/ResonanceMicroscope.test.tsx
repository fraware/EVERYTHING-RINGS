import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResonanceMicroscope } from "./ResonanceMicroscope";

function mode(frequencyHz: number, relativeAmplitude: number, decaySeconds: number): AcousticMode {
  return {
    frequencyHz,
    relativeAmplitude,
    decaySeconds,
    q: Math.PI * frequencyHz * decaySeconds,
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
  modes: [mode(440, 1, 0.3), mode(880, 0.5, 1.2), mode(1760, 0.25, 2)],
};

describe("Resonance Microscope ringdown reveal", () => {
  it("renders capture-model comparison and explicit fitted-envelope state", () => {
    const markup = renderToStaticMarkup(
      <ResonanceMicroscope
        fingerprint={FINGERPRINT}
        onHearMode={() => undefined}
        onHearAll={() => undefined}
        onHearCapture={() => undefined}
      />,
    );

    expect(markup).toContain("CAPTURE");
    expect(markup).toContain("Recorded microphone transient");
    expect(markup).toContain("MODEL");
    expect(markup).toContain("Measured-mode reconstruction");
    expect(markup).toContain("WATCH + HEAR MODEL");
    expect(markup).toContain('aria-label="Elapsed ringdown time"');
    expect(markup).toContain("MODELED DOMINANT");
    expect(markup).toContain("≥ 10% ENVELOPE");
    expect(markup).toContain("3 / 3");
    expect(markup).toContain("100% of its fitted initial envelope at +0.00 s");
    expect(markup).toContain("STRONGEST AT STRIKE");
    expect(markup).toContain("DOMINANT NOW");
  });
});
