import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConsumerLanding } from "./ConsumerExperience";
import type { ConsumerCaptureRecord } from "./consumerHistory";

const FINGERPRINT: AcousticFingerprintV1 = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48_000,
  durationSeconds: 1,
  modes: [{
    frequencyHz: 440,
    relativeAmplitude: 1,
    decaySeconds: 0.6,
    q: 800,
    confidence: 0.9,
    diagnostics: {
      prominenceDb: 18,
      persistenceSeconds: 0.5,
      frequencyStdCents: 3,
      decayFitScore: 0.9,
      observationCount: 12,
    },
  }],
};

function record(id: string, signature: string): ConsumerCaptureRecord {
  return {
    schemaVersion: 1,
    id,
    capturedAt: "2026-08-18T12:00:00.000Z",
    softwareRevision: null,
    signature,
    fingerprint: FINGERPRINT,
  };
}

describe("consumer history comparison selection", () => {
  it("offers comparison only when at least two capture records exist", () => {
    const one = renderToStaticMarkup(
      <ConsumerLanding
        onStart={vi.fn()}
        recentCaptures={[record("a", "er1-1111111111111111")]}
        onCompareCapture={vi.fn()}
      />,
    );
    expect(one).not.toContain(">COMPARE<");

    const two = renderToStaticMarkup(
      <ConsumerLanding
        onStart={vi.fn()}
        recentCaptures={[
          record("a", "er1-1111111111111111"),
          record("b", "er1-2222222222222222"),
        ]}
        onCompareCapture={vi.fn()}
      />,
    );
    expect(two).toContain(">COMPARE<");
  });

  it("marks the first selected observation and asks for a second one", () => {
    const html = renderToStaticMarkup(
      <ConsumerLanding
        onStart={vi.fn()}
        recentCaptures={[
          record("a", "er1-1111111111111111"),
          record("b", "er1-2222222222222222"),
        ]}
        compareAnchorId="a"
        onCompareCapture={vi.fn()}
      />,
    );

    expect(html).toContain("consumer-history-card-selected");
    expect(html).toContain("CANCEL COMPARE");
    expect(html).toContain("COMPARE WITH");
    expect(html).toContain('aria-pressed="true"');
  });
});
