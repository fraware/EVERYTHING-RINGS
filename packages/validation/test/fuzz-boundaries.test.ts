import { describe, it } from "vitest";
import { parseValidationEvidence } from "../src";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomJson(random: () => number, depth = 0): unknown {
  const choice = depth >= 3 ? Math.floor(random() * 5) : Math.floor(random() * 8);
  switch (choice) {
    case 0: return null;
    case 1: return random() < 0.5;
    case 2: return (random() - 0.5) * 1e12;
    case 3: return random().toString(36).repeat(Math.floor(random() * 4));
    case 4: return random() < 0.2 ? Number.NaN : random() < 0.25 ? Number.POSITIVE_INFINITY : 0;
    case 5: return Array.from({ length: Math.floor(random() * 6) }, () => randomJson(random, depth + 1));
    default: {
      const value: Record<string, unknown> = {};
      for (let index = 0; index < Math.floor(random() * 7); index += 1) {
        value[`k${Math.floor(random() * 20)}`] = randomJson(random, depth + 1);
      }
      return value;
    }
  }
}

describe("validation parser fuzz boundary", () => {
  it("never throws for 20000 arbitrary JSON-like inputs", () => {
    for (let seed = 1; seed <= 20000; seed += 1) {
      const random = rng(seed);
      const input = randomJson(random);
      try {
        const result = parseValidationEvidence(input);
        if (typeof result.ok !== "boolean") throw new Error("parser returned malformed result");
        if (result.ok) {
          if (result.evidence.schemaVersion !== 5) throw new Error("parser accepted wrong schema version");
          if (!/^[0-9a-f]{40}$/.test(result.evidence.softwareRevision)) throw new Error("parser accepted invalid software revision");
        }
      } catch (error) {
        throw new Error(`seed ${seed}: parser threw on arbitrary input: ${String(error)}`);
      }
    }
  });
});
