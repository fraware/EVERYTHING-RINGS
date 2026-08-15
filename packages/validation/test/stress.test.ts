import { describe, it } from "vitest";
import {
  evaluateGateARelease,
  mergeValidationEvidence,
  parseValidationEvidence,
} from "../src";
import { evidence, fiveObjects } from "./helpers";

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

function revision(seed: number): string {
  const random = rng(seed);
  const hex = "0123456789abcdef";
  return Array.from({ length: 40 }, () => hex[Math.floor(random() * hex.length)]).join("");
}

describe("validation stress invariants", () => {
  it("accepts 1000 valid revisions and rejects malformed provenance", () => {
    for (let seed = 1; seed <= 1000; seed += 1) {
      const softwareRevision = revision(seed);
      const bundle = evidence(`object-${seed}`, "metal", {
        sessionId: `session-${seed}`,
        specimenId: `specimen-${seed}`,
        softwareRevision,
      });
      if (!parseValidationEvidence(bundle).ok) throw new Error(`seed ${seed}: valid evidence rejected`);
      if (parseValidationEvidence({ ...bundle, softwareRevision: `g${softwareRevision.slice(1)}` }).ok) {
        throw new Error(`seed ${seed}: non-hex revision accepted`);
      }
      if (parseValidationEvidence({ ...bundle, softwareRevision: softwareRevision.slice(0, 39) }).ok) {
        throw new Error(`seed ${seed}: short revision accepted`);
      }
    }
  });

  it("keeps 1000 same-revision Gate A releases valid and rejects a mixed revision", () => {
    for (let seed = 1; seed <= 1000; seed += 1) {
      const softwareRevision = revision(seed + 2000);
      const bundles = fiveObjects().map((bundle, index) => ({
        ...bundle,
        sessionId: `${bundle.sessionId}-${seed}-${index}`,
        softwareRevision,
      }));
      const valid = evaluateGateARelease(bundles);
      if (!valid.passed || valid.softwareRevision !== softwareRevision) {
        throw new Error(`seed ${seed}: homogeneous release did not pass`);
      }
      const mixed = bundles.map((bundle, index) => index === 4
        ? { ...bundle, softwareRevision: `f${softwareRevision.slice(1)}` === softwareRevision ? `e${softwareRevision.slice(1)}` : `f${softwareRevision.slice(1)}` }
        : bundle);
      if (evaluateGateARelease(mixed).passed) throw new Error(`seed ${seed}: mixed-revision release passed`);
    }
  });

  it("merges 1000 repeated exports without changing immutable measurement provenance", () => {
    for (let seed = 1; seed <= 1000; seed += 1) {
      const softwareRevision = revision(seed + 4000);
      const base = evidence(`merge-${seed}`, "ceramic", {
        sessionId: `merge-session-${seed}`,
        specimenId: `merge-specimen-${seed}`,
        softwareRevision,
      });
      const newer = { ...base, createdAt: `2026-08-15T12:00:00.${String(seed % 1000).padStart(3, "0")}Z` };
      const merged = mergeValidationEvidence(base, newer);
      if (!merged.ok) throw new Error(`seed ${seed}: compatible repeated export failed to merge: ${merged.error}`);
      if (merged.evidence.softwareRevision !== softwareRevision) throw new Error(`seed ${seed}: revision changed during merge`);
      const conflicting = mergeValidationEvidence(base, { ...newer, softwareRevision: revision(seed + 5000) });
      if (conflicting.ok) throw new Error(`seed ${seed}: conflicting software revision merged`);
    }
  });
});
