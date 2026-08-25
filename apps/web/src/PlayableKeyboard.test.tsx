import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlayableKeyboard } from "./PlayableKeyboard";

describe("PlayableKeyboard", () => {
  it("keeps the consumer surface as thirteen accessible native buttons", () => {
    const html = renderToStaticMarkup(<PlayableKeyboard
      id="test-keys"
      ariaLabel="Test chromatic keys"
      onNote={vi.fn()}
    />);

    expect(html).toContain('id="test-keys"');
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Test chromatic keys"');
    expect(html).toContain('aria-label="Play C4, MIDI 60"');
    expect(html).toContain('aria-label="Play C5, MIDI 72"');
    expect((html.match(/<button/g) ?? []).length).toBe(13);
  });

  it("renders the lab surface disabled until playback is ready", () => {
    const html = renderToStaticMarkup(<PlayableKeyboard
      disabled
      onNoteOn={vi.fn(() => false)}
    />);

    expect(html).toContain('class="keyboard playable-keys playable-keys-lab"');
    expect(html).toContain('aria-label="Chromatic playable object"');
    expect(html).toContain('disabled=""');
    expect(html).toContain(">C4</button>");
    expect(html).toContain(">C5</button>");
    expect((html.match(/<button/g) ?? []).length).toBe(13);
  });

  it("announces lab playback recovery without changing the keyboard contract", () => {
    const html = renderToStaticMarkup(<PlayableKeyboard
      playbackFailure="Tap the sound control again."
      onNoteOn={vi.fn(() => false)}
    />);

    expect(html).toContain('role="alert"');
    expect(html).toContain("Tap the sound control again.");
    expect((html.match(/<button/g) ?? []).length).toBe(13);
  });
});
