import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ConsumerCaptureRecord } from "./consumerHistory";
import { SavedCaptureView } from "./SavedCaptureView";

const FINGERPRINT: AcousticFingerprintV1 = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48_000,
  durationSeconds: 1.2,
  modes: [{
    frequencyHz: 523.25,
    relativeAmplitude: 1,
    decaySeconds: 0.7,
    q: 1150,
    confidence: 0.93,
    diagnostics: {
      prominenceDb: 22,
      persistenceSeconds: 0.6,
      frequencyStdCents: 2.4,
      decayFitScore: 0.91,
      observationCount: 16,
    },
  }],
};

const RECORD: ConsumerCaptureRecord = {
  schemaVersion: 1,
  id: "2026-08-18T12:00:00.000Z-er1-0123456789abcdef",
  capturedAt: "2026-08-18T12:00:00.000Z",
  softwareRevision: "60fe9913e6c0d90719c85028ee279942f35996d3",
  signature: "er1-0123456789abcdef",
  fingerprint: FINGERPRINT,
};

describe("saved capture view", () => {
  it("makes the fingerprint-only truth boundary, provenance, and share link explicit", () => {
    const html = renderToStaticMarkup(
      <SavedCaptureView
        record={RECORD}
        onBack={vi.fn()}
        onShareLink={vi.fn()}
        onShareDna={vi.fn()}
      />,
    );

    expect(html).toContain("SAVED CAPTURE");
    expect(html).toContain("Play this discovery again");
    expect(html).toContain("Original microphone audio was not retained");
    expect(html).toContain("cannot replay the original strike");
    expect(html).toContain(RECORD.signature);
    expect(html).toContain("er-dsp-2");
    expect(html).toContain(RECORD.softwareRevision);
    expect(html).toContain("CAPTURE NOT STORED");
    expect(html).toContain("Measured-mode reconstruction");
    expect(html).toContain("Chromatic saved fingerprint keys");
    expect(html).toContain("SHARE LINK");
    expect(html).toContain("SHARE DNA");
    expect(html).toContain("BACK TO HISTORY");
  });
});
