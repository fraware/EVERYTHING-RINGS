import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { fingerprintSignature } from "@everything-rings/visual";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SharedCaptureView } from "./SharedCaptureView";

const FINGERPRINT: AcousticFingerprintV1 = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48_000,
  durationSeconds: 2.4,
  modes: [
    {
      frequencyHz: 440,
      relativeAmplitude: 1,
      decaySeconds: 1.2,
      q: 1600,
      confidence: 0.94,
      diagnostics: { prominenceDb: 20, persistenceSeconds: 1, frequencyStdCents: 3, decayFitScore: 0.92, observationCount: 18 },
    },
    {
      frequencyHz: 997,
      relativeAmplitude: 0.55,
      decaySeconds: 0.7,
      q: 2100,
      confidence: 0.88,
      diagnostics: { prominenceDb: 15, persistenceSeconds: 0.6, frequencyStdCents: 5, decayFitScore: 0.87, observationCount: 13 },
    },
  ],
};

describe("shared Acoustic Capsule view", () => {
  it("prioritizes hear, play, try, and reshare while stating trust and identity boundaries", () => {
    const signature = fingerprintSignature(FINGERPRINT);
    const html = renderToStaticMarkup(<SharedCaptureView
      fingerprint={FINGERPRINT}
      signature={signature}
      onShareAgain={vi.fn()}
      onTryOwn={vi.fn()}
    />);

    expect(html).toContain("SHARED RING");
    expect(html).toContain("Hear what they found");
    expect(html).toContain("HEAR THIS RING");
    expect(html).toContain("PLAY IT");
    expect(html).toContain("TRY YOUR OWN");
    expect(html).toContain("SHARE AGAIN");
    expect(html).toContain("microphone stays on this device");
    expect(html).toContain("A fingerprint, not the original recording");
    expect(html).toContain("does not identify a physical object");
    expect(html).toContain("not authenticated capture provenance");
    expect(html).toContain(signature);
  });
});
