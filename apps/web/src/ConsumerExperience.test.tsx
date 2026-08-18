import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConsumerFailure, ConsumerLanding, ConsumerProgress, ConsumerReveal } from "./ConsumerExperience";

const FINGERPRINT: AcousticFingerprintV1 = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48_000,
  durationSeconds: 1.4,
  modes: [
    {
      frequencyHz: 440,
      relativeAmplitude: 1,
      decaySeconds: 0.8,
      q: 1105,
      confidence: 0.96,
      diagnostics: { prominenceDb: 24, persistenceSeconds: 0.7, frequencyStdCents: 2, decayFitScore: 0.95, observationCount: 18 },
    },
    {
      frequencyHz: 997,
      relativeAmplitude: 0.55,
      decaySeconds: 0.45,
      q: 1410,
      confidence: 0.91,
      diagnostics: { prominenceDb: 18, persistenceSeconds: 0.4, frequencyStdCents: 3, decayFitScore: 0.9, observationCount: 14 },
    },
  ],
};

describe("consumer experience contract", () => {
  it("explains microphone permission and the first strike before asking the user to start", () => {
    const html = renderToStaticMarkup(<ConsumerLanding onStart={vi.fn()} />);
    expect(html).toContain("allow microphone access");
    expect(html).toContain("one clean strike");
    expect(html).toContain("START LISTENING");
    expect(html).toContain("Your microphone stays local");
  });

  it("announces progress and failures to assistive technology", () => {
    const progress = renderToStaticMarkup(<ConsumerProgress message="Finding its resonances…" state="analyzing" onCancel={vi.fn()} />);
    expect(progress).toContain('role="status"');
    expect(progress).toContain('aria-live="polite"');
    expect(progress).toContain('aria-hidden="true"');
    const failure = renderToStaticMarkup(<ConsumerFailure message="Microphone access is blocked." onRetry={vi.fn()} onStartOver={vi.fn()} />);
    expect(failure).toContain('role="alert"');
    expect(failure).toContain("TRY AGAIN");
  });

  it("keeps the reveal understandable and exposes the low-friction share action", () => {
    const html = renderToStaticMarkup(<ConsumerReveal
      fingerprint={FINGERPRINT}
      instrumentReady
      onHearMode={vi.fn()}
      onHearModel={vi.fn()}
      onHearCapture={vi.fn()}
      onNote={vi.fn()}
      onShareLink={vi.fn()}
      onShareStory={vi.fn()}
      onShareDna={vi.fn()}
      onStrikeAnother={vi.fn()}
    />);
    expect(html).toContain("You found 2 resonances");
    expect(html).toContain("SHARE LINK");
    expect(html).toContain("SHARE STORY");
    expect(html).toContain("SHARE DNA");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="consumer-playable-keys"');
  });

  it("surfaces playback recovery in the reveal", () => {
    const html = renderToStaticMarkup(<ConsumerReveal
      fingerprint={FINGERPRINT}
      instrumentReady
      playbackFailure="Tap the sound control again."
      onHearMode={vi.fn()}
      onHearModel={vi.fn()}
      onHearCapture={vi.fn()}
      onNote={vi.fn()}
      onShareLink={vi.fn()}
      onShareStory={vi.fn()}
      onShareDna={vi.fn()}
      onStrikeAnother={vi.fn()}
    />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Tap the sound control again");
  });
});
