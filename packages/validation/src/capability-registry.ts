import type { AssuranceEvidenceReferenceV1, EvidenceDomain } from "./assurance";
import { contentDigest, isContentDigest } from "./provenance";

export const CAPABILITY_REGISTRY_CONTRACT_VERSION = "capability-registry-1" as const;
export const CAPABILITY_REGISTRY_ENTRY_CONTRACT_VERSION = "capability-registry-entry-1" as const;

export const CAPABILITY_MATURITY_LADDER = [
  "prototype",
  "software-qualified",
  "synthetic-qualified",
  "physical-research",
  "held-out-validated",
  "product-eligible",
  "released",
] as const;

export type CapabilityMaturity = (typeof CAPABILITY_MATURITY_LADDER)[number];

export type SoftwareOnlyMaturity = "prototype" | "software-qualified" | "synthetic-qualified";

export type NextPhysicalMaturity<From extends CapabilityMaturity> =
  From extends "prototype" ? "software-qualified"
    : From extends "software-qualified" ? "synthetic-qualified"
      : From extends "synthetic-qualified" ? "physical-research"
        : From extends "physical-research" ? "held-out-validated"
          : From extends "held-out-validated" ? "product-eligible"
            : From extends "product-eligible" ? "released"
              : never;

export const CAPABILITY_REGISTRY_IDS = [
  "resonance-estimation",
  "reconstruction",
  "playable-identity",
  "station-qualification",
  "twin-retrieval",
  "twin-verification",
  "spatial-prediction",
  "material-inference",
  "atlas-integrity",
  "atlas-network-conformance",
] as const;

export type CapabilityRegistryId = (typeof CAPABILITY_REGISTRY_IDS)[number];

export type CapabilityReviewState = "unreviewed" | "implementer-attested" | "independently-reviewed";

export interface CapabilityRegistryEntryV1 {
  readonly schemaVersion: 1;
  readonly registryEntryContractVersion: "capability-registry-entry-1";
  readonly entryId: string;
  readonly createdAt: string;
  readonly capability: CapabilityRegistryId;
  readonly proposition: string;
  readonly capabilityVersion: string;
  readonly population: string;
  readonly exclusions: readonly string[];
  readonly evidenceDomain: EvidenceDomain;
  readonly evidence: readonly AssuranceEvidenceReferenceV1[];
  readonly doesNotEstablish: readonly string[];
  readonly maturity: CapabilityMaturity;
  readonly priorMaturity: CapabilityMaturity | null;
  readonly physicalClaim: boolean;
  readonly physicalObjectTested: boolean;
  readonly reviewState: CapabilityReviewState;
  readonly reviewerIsImplementer: boolean;
}

export interface CapabilityRegistryV1 {
  readonly schemaVersion: 1;
  readonly registryContractVersion: "capability-registry-1";
  readonly registryId: string;
  readonly createdAt: string;
  readonly entries: readonly CapabilityRegistryEntryV1[];
}

const MATURITY_INDEX = new Map<CapabilityMaturity, number>(
  CAPABILITY_MATURITY_LADDER.map((rung, index) => [rung, index]),
);

export function physicalClaimNextMaturity<From extends CapabilityMaturity>(from: From): NextPhysicalMaturity<From> {
  const index = MATURITY_INDEX.get(from);
  if (index === undefined || index >= CAPABILITY_MATURITY_LADDER.length - 1) {
    throw new Error(`no next physical-claim maturity rung after ${from}`);
  }
  return CAPABILITY_MATURITY_LADDER[index + 1] as NextPhysicalMaturity<From>;
}

export function assertPhysicalClaimMaturityTransition(
  from: CapabilityMaturity,
  to: CapabilityMaturity,
): void {
  if (from === "software-qualified" && to === "released") {
    throw new Error("physical claim cannot skip from software-qualified to released");
  }
  const expected = physicalClaimNextMaturity(from);
  if (to !== expected) {
    throw new Error(`physical claim cannot skip from ${from} to ${to}; next rung is ${expected}`);
  }
}

function requiredText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error(`${field} is required`);
  return trimmed;
}

function assertEvidence(evidence: readonly AssuranceEvidenceReferenceV1[]): AssuranceEvidenceReferenceV1[] {
  if (evidence.length === 0) throw new Error("capability registry entry requires evidence");
  return evidence.map((reference) => {
    if (reference.description.trim().length === 0) throw new Error("capability evidence description is required");
    if (!isContentDigest(reference.evidenceId) && !/^[0-9a-f]{40}$/.test(reference.evidenceId) && !/^github-run:\d+$/.test(reference.evidenceId)) {
      throw new Error("capability evidenceId must be a SHA-256 digest, Git revision, or github-run:<id>");
    }
    return { evidenceId: reference.evidenceId, domain: reference.domain, description: reference.description.trim() };
  });
}

function assertPhysicalClaimInvariants(input: {
  readonly physicalClaim: boolean;
  readonly physicalObjectTested: boolean;
  readonly maturity: CapabilityMaturity;
  readonly priorMaturity: CapabilityMaturity | null;
  readonly evidenceDomain: EvidenceDomain;
  readonly evidence: readonly AssuranceEvidenceReferenceV1[];
  readonly reviewState: CapabilityReviewState;
  readonly reviewerIsImplementer: boolean;
}): void {
  if (!input.physicalClaim) {
    if (input.physicalObjectTested !== false) {
      throw new Error("software-only capability claims must set physicalObjectTested: false");
    }
    return;
  }
  if (input.priorMaturity === null) {
    if (input.maturity !== "prototype" && input.maturity !== "software-qualified" && input.maturity !== "synthetic-qualified") {
      throw new Error("physical claim above synthetic-qualified requires priorMaturity");
    }
  } else {
    assertPhysicalClaimMaturityTransition(input.priorMaturity, input.maturity);
  }
  const physicalRungs: ReadonlySet<CapabilityMaturity> = new Set(["physical-research", "held-out-validated", "product-eligible", "released"]);
  if (physicalRungs.has(input.maturity)) {
    if (input.physicalObjectTested !== true) throw new Error("physical-claim maturity requires physicalObjectTested: true");
    if (input.evidenceDomain !== "physical" && !input.evidence.some((reference) => reference.domain === "physical")) {
      throw new Error("physical-claim maturity requires physical-domain evidence");
    }
  }
  if (input.maturity === "product-eligible" || input.maturity === "released") {
    if (input.reviewState !== "independently-reviewed" || input.reviewerIsImplementer) {
      throw new Error("product-facing physical claims require independent review by someone other than the implementer");
    }
  }
}

export async function createCapabilityRegistryEntry(
  input: Omit<CapabilityRegistryEntryV1, "schemaVersion" | "registryEntryContractVersion" | "entryId">,
): Promise<CapabilityRegistryEntryV1> {
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("capability registry entry createdAt is invalid");
  if (!CAPABILITY_REGISTRY_IDS.includes(input.capability)) throw new Error("capability registry id is invalid");
  const evidence = assertEvidence(input.evidence);
  assertPhysicalClaimInvariants({ ...input, evidence });
  const payload = {
    capability: input.capability,
    capabilityVersion: requiredText(input.capabilityVersion, "capabilityVersion"),
    createdAt: input.createdAt,
    doesNotEstablish: input.doesNotEstablish.map((item) => requiredText(item, "doesNotEstablish")),
    evidence,
    evidenceDomain: input.evidenceDomain,
    exclusions: input.exclusions.map((item) => requiredText(item, "exclusions")),
    maturity: input.maturity,
    physicalClaim: input.physicalClaim,
    physicalObjectTested: input.physicalObjectTested,
    population: requiredText(input.population, "population"),
    priorMaturity: input.priorMaturity,
    proposition: requiredText(input.proposition, "proposition"),
    registryEntryContractVersion: CAPABILITY_REGISTRY_ENTRY_CONTRACT_VERSION,
    reviewState: input.reviewState,
    reviewerIsImplementer: input.reviewerIsImplementer,
    schemaVersion: 1 as const,
  };
  if (payload.doesNotEstablish.length === 0) throw new Error("capability registry entry must state what it does not establish");
  if (payload.exclusions.length === 0) throw new Error("capability registry entry requires exclusions");
  return { ...payload, entryId: await contentDigest(payload) };
}

export async function verifyCapabilityRegistryEntry(entry: CapabilityRegistryEntryV1): Promise<boolean> {
  if (entry.schemaVersion !== 1 || entry.registryEntryContractVersion !== CAPABILITY_REGISTRY_ENTRY_CONTRACT_VERSION) return false;
  if (!isContentDigest(entry.entryId) || !Number.isFinite(Date.parse(entry.createdAt))) return false;
  try {
    assertEvidence(entry.evidence);
    assertPhysicalClaimInvariants(entry);
    requiredText(entry.proposition, "proposition");
    requiredText(entry.population, "population");
    requiredText(entry.capabilityVersion, "capabilityVersion");
  } catch {
    return false;
  }
  const { entryId, ...payload } = entry;
  return entryId === await contentDigest(payload);
}

export async function createCapabilityRegistry(
  input: Omit<CapabilityRegistryV1, "schemaVersion" | "registryContractVersion" | "registryId">,
): Promise<CapabilityRegistryV1> {
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("capability registry createdAt is invalid");
  if (input.entries.length === 0) throw new Error("capability registry requires entries");
  const seen = new Set<CapabilityRegistryId>();
  for (const entry of input.entries) {
    if (!await verifyCapabilityRegistryEntry(entry)) throw new Error(`capability registry entry ${entry.capability} failed verification`);
    if (seen.has(entry.capability)) throw new Error(`duplicate capability registry entry ${entry.capability}`);
    seen.add(entry.capability);
  }
  const entries = [...input.entries].sort((left, right) => left.capability.localeCompare(right.capability, "en-US"));
  const payload = {
    createdAt: input.createdAt,
    entries,
    registryContractVersion: CAPABILITY_REGISTRY_CONTRACT_VERSION,
    schemaVersion: 1 as const,
  };
  return { ...payload, registryId: await contentDigest(payload) };
}

export async function verifyCapabilityRegistry(registry: CapabilityRegistryV1): Promise<boolean> {
  if (registry.schemaVersion !== 1 || registry.registryContractVersion !== CAPABILITY_REGISTRY_CONTRACT_VERSION) return false;
  if (!isContentDigest(registry.registryId) || !Number.isFinite(Date.parse(registry.createdAt))) return false;
  if (registry.entries.length === 0) return false;
  const seen = new Set<CapabilityRegistryId>();
  for (const entry of registry.entries) {
    if (!await verifyCapabilityRegistryEntry(entry)) return false;
    if (seen.has(entry.capability)) return false;
    seen.add(entry.capability);
  }
  const { registryId, ...payload } = registry;
  return registryId === await contentDigest(payload);
}

interface SoftwareClaimDraft {
  readonly capability: CapabilityRegistryId;
  readonly proposition: string;
  readonly capabilityVersion: string;
  readonly population: string;
  readonly exclusions: readonly string[];
  readonly evidenceDomain: EvidenceDomain;
  readonly doesNotEstablish: readonly string[];
}

const SOFTWARE_CLAIM_DRAFTS: readonly SoftwareClaimDraft[] = [
  {
    capability: "resonance-estimation",
    proposition: "Estimated audible resonances supported by each recorded transient under the frozen fingerprint algorithm.",
    capabilityVersion: "er-dsp-2",
    population: "software and digital-twin qualification corpora",
    exclusions: ["physical eigenmodes", "material identity", "physical-object identity", "calibrated loudness"],
    evidenceDomain: "software",
    doesNotEstablish: ["eigenmodes", "material identity", "physical-object identity", "that nearby peaks are the same physical mode"],
  },
  {
    capability: "reconstruction",
    proposition: "A renderer can reconstruct a playable signal from a content-addressed fingerprint in software tests.",
    capabilityVersion: "modal-renderer-2",
    population: "software qualification",
    exclusions: ["human perceptual validity", "physical object identity"],
    evidenceDomain: "software",
    doesNotEstablish: ["that reconstructed audio is perceptually identical to the physical object", "microphone-chain truth"],
  },
  {
    capability: "playable-identity",
    proposition: "A playable instrument can be derived from a fingerprint without rewriting measurement identity.",
    capabilityVersion: "modal-instrument-3",
    population: "software qualification",
    exclusions: ["physical-object identity", "human perceptual validation"],
    evidenceDomain: "software",
    doesNotEstablish: ["that the instrument is the same physical object", "timbre identity under real transducers"],
  },
  {
    capability: "station-qualification",
    proposition: "The station protocol evaluates whether a station reproduces a declared reference-object modal structure.",
    capabilityVersion: "station-qualification-1",
    population: "digital station fixtures",
    exclusions: ["absolute loudness", "global device equivalence", "physical station qualification"],
    evidenceDomain: "digital-twin",
    doesNotEstablish: ["physical station qualification", "absolute loudness calibration", "global device equivalence"],
  },
  {
    capability: "twin-retrieval",
    proposition: "Deterministic retrieval ranks the correct digital specimen first in the named software qualification corpus.",
    capabilityVersion: "sonic-twin-retrieval-1",
    population: "built-in digital qualification corpus only",
    exclusions: ["physical-object identity", "material identity"],
    evidenceDomain: "digital-twin",
    doesNotEstablish: ["physical same-object identity", "universal retrieval performance"],
  },
  {
    capability: "twin-verification",
    proposition: "Match / nonmatch / abstain verification runs on the digital Twin baseline with software-qualified calibration contracts.",
    capabilityVersion: "sonic-twin-isotonic-calibration-2",
    population: "built-in digital qualification corpus only",
    exclusions: ["physical same-object probability", "universal identity score"],
    evidenceDomain: "digital-twin",
    doesNotEstablish: ["calibrated physical same-object probability", "that a scalar score is a probability on a physical population"],
  },
  {
    capability: "spatial-prediction",
    proposition: "Spatial predicted fingerprints are produced as research predictions with evidenceEligible false.",
    capabilityVersion: "spatial-modal-field-1",
    population: "software spatial fixtures",
    exclusions: ["measured spatial field", "evidence-eligible fingerprints"],
    evidenceDomain: "software",
    doesNotEstablish: ["that a predicted fingerprint is a measurement", "physical spatial validation"],
  },
  {
    capability: "material-inference",
    proposition: "A research-only centroid baseline can emit a material hypothesis with evidenceEligible false.",
    capabilityVersion: "material-centroid-research-1",
    population: "software material-research fixtures",
    exclusions: ["consumer material labels", "physical material identity"],
    evidenceDomain: "software",
    doesNotEstablish: ["what an object is made of", "calibrated material probability", "family-disjoint physical performance"],
  },
  {
    capability: "atlas-integrity",
    proposition: "Content-addressed Atlas artifacts detect mutation in software tests.",
    capabilityVersion: "resonance-atlas-record-1",
    population: "software qualification",
    exclusions: ["physical provenance truth", "production network durability"],
    evidenceDomain: "software",
    doesNotEstablish: ["physical object identity", "that a published capture has a canonical object"],
  },
  {
    capability: "atlas-network-conformance",
    proposition: "The in-memory Atlas service adapter preserves idempotent publish, exact read-back, and deterministic search.",
    capabilityVersion: "resonance-atlas-service-1",
    population: "software conformance harness",
    exclusions: ["production persistence", "authentication", "rate limits"],
    evidenceDomain: "software",
    doesNotEstablish: ["production Atlas security", "durable storage", "public-network readiness"],
  },
];

export const SOFTWARE_CAPABILITY_REGISTRY_CREATED_AT = "2026-08-25T00:00:00.000Z";
export const SOFTWARE_CAPABILITY_REGISTRY_EVIDENCE_REVISION = "0123456789abcdef0123456789abcdef01234567";

export async function createOfficialSoftwareCapabilityRegistry(): Promise<CapabilityRegistryV1> {
  const entries = await Promise.all(SOFTWARE_CLAIM_DRAFTS.map((draft) => createCapabilityRegistryEntry({
    createdAt: SOFTWARE_CAPABILITY_REGISTRY_CREATED_AT,
    capability: draft.capability,
    proposition: draft.proposition,
    capabilityVersion: draft.capabilityVersion,
    population: draft.population,
    exclusions: draft.exclusions,
    evidenceDomain: draft.evidenceDomain,
    evidence: [{
      evidenceId: SOFTWARE_CAPABILITY_REGISTRY_EVIDENCE_REVISION,
      domain: draft.evidenceDomain,
      description: "post-freeze software qualification revision",
    }],
    doesNotEstablish: draft.doesNotEstablish,
    maturity: "software-qualified",
    priorMaturity: "prototype",
    physicalClaim: false,
    physicalObjectTested: false,
    reviewState: "implementer-attested",
    reviewerIsImplementer: true,
  })));
  return createCapabilityRegistry({
    createdAt: SOFTWARE_CAPABILITY_REGISTRY_CREATED_AT,
    entries,
  });
}
