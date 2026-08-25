import { describe, expect, it } from "vitest";
import { sha256Digest, sha256Hex } from "../src/sha256.ts";

describe("source-byte SHA-256", () => {
  it("matches the FIPS 180-4 vector for abc", async () => {
    const bytes = new TextEncoder().encode("abc");
    expect(await sha256Hex(bytes)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await sha256Digest(bytes)).toBe("sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("hashes exact bytes rather than a UTF-8-normalized or JSON-reserialized form", async () => {
    const pretty = new TextEncoder().encode('{\n  "a": 1\n}\n');
    const compact = new TextEncoder().encode('{"a":1}');
    expect(await sha256Hex(pretty)).not.toBe(await sha256Hex(compact));
  });
});
