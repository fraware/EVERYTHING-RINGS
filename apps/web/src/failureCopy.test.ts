import { describe, expect, it } from "vitest";
import { failureCopy } from "./failureCopy";

const cases = [
  ["SECURE_CONTEXT_REQUIRED", "Microphone access requires a secure connection. Open this experience over HTTPS and try again."],
  ["MICROPHONE_UNSUPPORTED", "This browser cannot open a microphone for this experience. Try a current browser with microphone support."],
  ["MICROPHONE_PERMISSION_DENIED", "Microphone access is blocked. Allow microphone access for this site, then try again."],
  ["MICROPHONE_NOT_FOUND", "No microphone was found. Connect or enable a microphone, then try again."],
  ["MICROPHONE_UNAVAILABLE", "The microphone is unavailable or already in use. Close other audio apps and try again."],
  ["MICROPHONE_CONSTRAINTS_UNSATISFIED", "This microphone could not provide a compatible capture stream. Try another input or browser."],
  ["MICROPHONE_OPEN_FAILED", "The microphone could not be opened. Check the input and try again."],
  ["MICROPHONE_DISCONNECTED", "The microphone disconnected. Reconnect or reselect the input, then start again."],
] as const;

describe("microphone failure copy", () => {
  for (const [reason, expected] of cases) {
    it(`renders recovery guidance for ${reason}`, () => {
      expect(failureCopy(reason)).toBe(expected);
    });
  }

  it("does not hide an unknown diagnostic", () => {
    expect(failureCopy("UNEXPECTED_DIAGNOSTIC")).toBe("UNEXPECTED_DIAGNOSTIC");
  });
});
