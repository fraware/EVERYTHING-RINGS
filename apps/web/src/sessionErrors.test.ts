import { describe, expect, it } from "vitest";
import { microphoneStartFailureCopy, playbackFailureCopy } from "./sessionErrors";

function namedError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

describe("session error copy", () => {
  it("explains microphone permission recovery", () => {
    expect(microphoneStartFailureCopy(namedError("NotAllowedError"), true)).toContain("Allow microphone access");
  });

  it("explains missing and busy microphones", () => {
    expect(microphoneStartFailureCopy(namedError("NotFoundError"), true)).toContain("No microphone");
    expect(microphoneStartFailureCopy(namedError("NotReadableError"), true)).toContain("already in use");
  });

  it("explains insecure context without leaking implementation detail", () => {
    expect(microphoneStartFailureCopy(new Error("anything"), false)).toContain("HTTPS");
  });

  it("uses a stable fallback and playback recovery message", () => {
    expect(microphoneStartFailureCopy(new Error("internal detail"), true)).not.toContain("internal detail");
    expect(playbackFailureCopy()).toContain("Tap the sound control again");
  });
});
