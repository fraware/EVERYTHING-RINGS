import { describe, expect, it } from "vitest";
import {
  evaluateGateASession,
  mergeValidationEvidence,
  parseValidationEvidence,
  parseValidationEvidenceJson,
} from "../src";
import { evidence } from "./helpers";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomJsonValue(random: () => number, depth = 0): unknown {
  const kind = Math.floor(random() * (depth >= 3 ? 5 : 7));
  switch (kind) {
    case 0: return null;
    case 1: return random() < 0.5;
    case 2: return (random() - 0.5) * 1e12;
    case 3: return Math.floor(random() * 1e6).toString(36);
    case 4: return Array.from({ length: Math.floor(random() * 7) }, () => randomJsonValue(random, depth + 1));
    case 5: {
      const object: Record<string, unknown> = {};
      for (let index = 0; index < Math.floor(random() * 7); index += 1) {
        object[`k${Math.floor(random() * 100)}`] = randomJsonValue(random, depth + 1);
      }
      return object;
    }
    default: return "";
  }
}

function allPaths(value: unknown, prefix: readonly (string | number)[] = []): Array<readonly (string | number)[]> {
  const paths: Array<readonly (string | number)[]> = [prefix];
  if (Array.isArray(value)) {
    value.forEach((child, index) => paths.push(...allPaths(child, [...prefix, index])));
  } else if (typeof value === "object" && value !== null) {
    Object.entries(value).forEach(([key, child]) => paths.push(...allPaths(child, [...prefix, key])));
  }
  return paths;
}

function mutateAtPath(root: unknown, path: readonly (string | number)[], replacement: unknown): unknown {
  if (path.length === 0) return replacement;
  const clone = structuredClone(root) as Record<string | number, unknown> | unknown[];
  let cursor: Record<string | number, unknown> | unknown[] = clone;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index] as string | number;
    cursor = (cursor as Record<string | number, unknown>)[key] as Record<string | number, unknown> | unknown[];
  }
  const key = path[path.length - 1] as string | number;
  (cursor as Record<string | number, unknown>)[key] = replacement;
  return clone;
}

describe("adversarial validation input fuzz", () => {
  it("never throws on 10,000 arbitrary JSON values or strings", () => {
    for (let seed = 0; seed < 10_000; seed += 1) {
      const random = rng(seed ^ 0x45565235);
      const value = randomJsonValue(random);
      expect(() => parseValidationEvidence(value), `value seed ${seed}`).not.toThrow();
      const text = random() < 0.5
        ? JSON.stringify(value)
        : `${Math.floor(random() * 1e9).toString(36)}${random() < 0.5 ? "{" : "]"}`;
      expect(() => parseValidationEvidenceJson(text), `text seed ${seed}`).not.toThrow();
    }
  }, 30_000);

  it("never throws on 5,000 deep near-valid mutations and evaluates any survivors", () => {
    const base = evidence("adversarial-bell", "metal", {
      specimenId: "adversarial-specimen",
      sessionId: "adversarial-session",
    });
    const paths = allPaths(base);
    const replacements: readonly unknown[] = [
      null, undefined, "", "x", -1, 0, 1e309, Number.NaN, true, false, [], {}, [null], { unexpected: true },
    ];
    for (let seed = 0; seed < 5_000; seed += 1) {
      const random = rng(seed ^ 0x50415253);
      const path = paths[Math.floor(random() * paths.length)] ?? [];
      const replacement = replacements[Math.floor(random() * replacements.length)];
      const mutated = mutateAtPath(base, path, replacement);
      let parsed: ReturnType<typeof parseValidationEvidence> | undefined;
      expect(() => { parsed = parseValidationEvidence(mutated); }, `mutation seed ${seed}, path ${path.join(".")}`).not.toThrow();
      if (parsed?.ok) {
        expect(() => evaluateGateASession(parsed.evidence), `evaluation seed ${seed}`).not.toThrow();
      }
    }
  }, 30_000);

  it("preserves merge idempotence for 1,000 distinct valid sessions", () => {
    for (let seed = 0; seed < 1_000; seed += 1) {
      const bundle = evidence(`merge-${seed}`, "metal", {
        specimenId: `specimen-${seed}`,
        sessionId: `session-${seed}`,
        comparisonCents: [3 + seed % 5, 5 + seed % 7, 7 + seed % 11, 9 + seed % 13],
      });
      const merged = mergeValidationEvidence(bundle, structuredClone(bundle));
      expect(merged.ok, `merge seed ${seed}`).toBe(true);
      if (merged.ok) expect(merged.evidence).toEqual(bundle);
    }
  });
});
