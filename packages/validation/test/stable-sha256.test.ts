import { describe, expect, it } from "vitest";
import { stableSha256Hex } from "../src/stable-sha256";

describe("stable SHA-256", () => {
  it("matches standard ASCII test vectors", () => {
    expect(stableSha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(stableSha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("is deterministic for unicode input", () => {
    expect(stableSha256Hex("everything rings — 🔔")).toBe(stableSha256Hex("everything rings — 🔔"));
    expect(stableSha256Hex("everything rings — 🔔")).not.toBe(stableSha256Hex("everything rings"));
  });
});
