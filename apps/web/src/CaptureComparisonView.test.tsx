import type { AcousticFingerprintV1, AcousticMode } from "@everything-rings/dsp";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CaptureComparisonView } from "./CaptureComparisonView";
import type { ConsumerCaptureRecord } from "./consumerHistory";

function mode(frequencyHz: number, amplitude: number, decaySeconds: number): AcousticMode {
  return {
    frequencyHz,
    relativeAmplitude: amplitude,
    decaySeconds,
    q: Math.PI * frequencyHz * decaySeconds,
    confidence: 0.9,
    diagnostics: {
      prominenceDb: 20,
      persistenceSeconds: decaySeconds * 0.8,
      frequencyStdCents: 2,
      decayFitScore: 0.93,
      observationCount: 16,
    },
  };
}

function record(
  id: string,
  signature: string,
  algorithmVersion: AcousticFingerprintV1["algorithmVersion"],
  modes: readonly AcousticMode[],
): ConsumerCaptureRecord {
  return {
    schemaVersion: 1,
    id,
    capturedAt: "2026-08-18T12:00:00.000Z",
    softwareRevision: "60fe9913e6c0d90719c85028ee279942f35996d3",
    signature,
    fingerprint: {
      version: 1,
      algorithmVersion,
      sampleRate: 48_000,
      durationSeconds: 2,
      modes,
    },
  };
}

const LEFT = record(
  "left",
  "er1-1111111111111111",
  "er-dsp-2",
  [mode(440, 1, 0.9), mode(1000, 0.5, 0.5)],
);
const RIGHT = record(
  "right",
  "er1-2222222222222222",
  "er-dsp-2",
  [mode(445, 1, 0.8), mode(1030, 0.6, 0.7)],
);

describe("CaptureComparisonView", () => {
  it("renders descriptive A/B evidence without an identity verdict", () => {
    const html = renderToStaticMarkup(
      <CaptureComparisonView left={LEFT} right={RIGHT} onBack={vi.fn()} />,
    );

    expect(html).toContain("RESONANCE DIFF");
    expect(html).toContain("Compare two capture observations");
    expect(html).toContain("No identity verdict");
    expect(html).toContain("HEAR A MODEL");
    expect(html).toContain("HEAR B MODEL");
    expect(html).toContain("OBSERVED PROPERTIES");
    expect(html).toContain("MUTUAL-NEAREST FREQUENCIES");
    expect(html).toContain("Threshold-free and one-to-one");
    expect(html).toContain("navigation aid only");
    expect(html).toContain(LEFT.signature);
    expect(html).toContain(RIGHT.signature);
    expect(html.toLowerCase()).not.toContain("similarity score");
    expect(html).not.toContain("SAME OBJECT");
    expect(html).not.toContain("DIFFERENT OBJECT");
  });

  it("warns when algorithm revisions differ", () => {
    const rightV1 = record(
      "right-v1",
      "er1-3333333333333333",
      "er-dsp-1",
      RIGHT.fingerprint.modes,
    );
    const html = renderToStaticMarkup(
      <CaptureComparisonView left={LEFT} right={rightV1} onBack={vi.fn()} />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Fingerprint algorithm versions differ");
    expect(html).toContain("analysis revision");
  });
});
