# EVERYTHING RINGS — Engineering Takeover & Full-Vision Execution Specification

**Status:** Engineering handoff / execution baseline  
**Date:** 2026-08-25  
**Coordination tracker:** #90  
**Primary product/research branch:** `post-freeze-development`  
**Empirical authority:** `main` / `freeze/gate-a2-v8-2026-08-25`

---

## 0. Purpose

This document is the engineering takeover specification for EVERYTHING RINGS. It is intended to let a strong engineering/research team continue the project without reconstructing its architecture, scientific boundaries, release semantics, or roadmap from scattered issues and historical commits.

The project north star is:

> **Hit anything. Discover how it rings.**

The current product is already a functioning local-first acoustic discovery instrument. The remaining work is not “finish an MVP.” It is to turn the existing instrument and software-qualified research architecture into a scientifically grounded physical measurement system, a calibrated Sonic Twin capability, a privacy-preserving Resonance Atlas, and eventually a participation network in which acoustic observations, object models, and derived artifacts can be explored without confusing a capture with the physical object that produced it.

A deeper directional ambition is that the system may eventually help a person infer what an object is made of from how it rings. That is a research direction, not a current product or scientific claim. Material inference must be earned independently from resonance estimation and independently from physical-object identity.

This specification has four jobs:

1. state the exact repository and release state engineers inherit;
2. preserve the non-negotiable scientific, privacy, provenance, and branch boundaries;
3. define all remaining major engineering and research workstreams with acceptance criteria;
4. specify a dependency order that lets an ambitious team move in parallel without contaminating the frozen empirical campaign or promoting unsupported claims.

---

## 1. Authority hierarchy and current repository state

### 1.1 Empirical authority

The first physical empirical campaign is frozen on:

- commit: `717a4c15a3b15e73c5883f34b86897c03ff70829`
- tree: `4343b2c77b88f6b5b8e9b44232964f209516b63a`
- branch: `main`
- immutable freeze: `freeze/gate-a2-v8-2026-08-25`
- fingerprint algorithm: `er-dsp-2`
- evidence contract: `validation-evidence-5` / `schemaVersion: 5`
- Gate A contract: `gate-a-2`
- campaign contract: `empirical-campaign-1`
- Gate B companion: `gate-b-listening-companion-1`
- Gate B contract: `gate-b-1`
- Gate C contract: `gate-c-1`
- hosted origin: `https://fraware.github.io/EVERYTHING-RINGS/`

Empirical v8 superseded v7 **before any physical campaign manifest, planned campaign strike, Gate A2 evidence, Gate B judgment, or Gate C judgment was accepted**. Issue #86 is the authority-transition record.

The empirical release sequence is still open. The current physical frontier is #64. The required order is:

`#64 physical intended-device preflight -> #65 specimen/manifest freeze -> #66 collection / #25 Gate A2 adjudication -> #28 Gate B -> #29 Gate C`

Do not reorder it.

### 1.2 Product/research integration trunk

At the time of this handoff, the integrated product/research trunk is:

- branch: `post-freeze-development`
- commit: `7f9922c60616425aa868e00982f4a265871b9953`
- tree: `bc56e58bf5bb5c00fdb6c02e352e7a5dd84221f1`

That trunk is 91 commits ahead of empirical v8 and intentionally contains capabilities that are **not** part of the frozen empirical application. It includes consumer reuse/sharing work plus software-only Sonic Twin, provenance, station-calibration, material-research, and Atlas scaffolding.

The exact `7f9922...` trunk passed:

- ordinary CI: run `32816250960`;
- full-vision software qualification: run `32816250955`;
- digital-twin qualification: run `32816250988`.

The corresponding qualification artifacts were:

- full-vision artifact `9551538696`, digest `sha256:cd5899e2261480ba4a31a942018a829c9488eb469b6a2356aad9fef05a6b7548`;
- digital-twin artifact `9551539705`, digest `sha256:8a44ddf606ee73a1b4d5036b228d3b6e0901e4755e1bfd1a9b723e9f4c3af4c4`.

These qualification artifacts establish software behavior on the named revision. They are not physical evidence.

### 1.3 Source precedence

When facts conflict, use this precedence:

1. exact immutable empirical freeze + live current operational issues #86/#64/#65/#66/#25/#28/#29;
2. exact code contracts and tests on the relevant branch/revision;
3. this engineering takeover specification for post-freeze development and roadmap decisions;
4. current repository documentation;
5. historical issues, historical qualification notes, and superseded revision records.

Historical issue #47 contains old v7 revision metadata. Its phase structure remains conceptually useful, but its exact empirical revision section is superseded by v8 and by this specification.

### 1.4 Open owner/governance work

Two non-scientific repository-governance issues remain open:

- #81: protect `main`, `post-freeze-development`, and all `freeze/*` refs with branch/ruleset controls;
- #82: choose and apply an explicit open-source license.

These should be resolved, but neither should mutate the frozen empirical Git tree merely for administrative cleanliness.

---

## 2. What is already built

The team should begin from the assumption that the software foundation is substantial. Rebuilding existing capabilities would waste time and increase semantic drift.

### 2.1 Consumer product

The product already implements:

- **STRIKE -> REVEAL -> HEAR -> PLAY**;
- browser microphone acquisition with a room-noise phase and capture-quality gating;
- deterministic impact DSP and versioned fingerprints;
- Ringdown Lens and Resonance Microscope;
- local capture/model listening;
- per-mode audition;
- modal reconstruction;
- real-time playable modal instruments;
- Acoustic DNA;
- Acoustic Story;
- bounded fingerprint-only local history;
- saved-capture output-only playback/instruments;
- Resonance Diff between two saved observations;
- Acoustic Capsules using bounded URL-fragment fingerprint transport;
- phone-first shared-capsule playback and one-tap `TRY YOUR OWN`;
- permission recovery, lifecycle cleanup, page-background cleanup, and error-boundary recovery;
- mobile accessibility/touch-target checks.

The consumer path deliberately does **not** persist microphone PCM in history or Capsules.

### 2.2 Empirical release application

The frozen v8 application already has:

- campaign authoring;
- finite candidate-register and deterministic-order support;
- campaign-bound collection;
- exact revision enforcement;
- first-five-qualified-attempt semantics;
- immutable analytical failures;
- schema-v5 evidence;
- Gate B private listening-companion binding;
- canonical Gate B and Gate C plan creation/parsing;
- Release Console accounting;
- deterministic upstream-verdict digest binding;
- Gate A2/B/C evaluators;
- canonical release-verdict generation;
- zero-microphone Gate B/C review routes.

Engineers must not “improve” those semantics during the active v8 physical sequence.

### 2.3 Research/software architecture already present on `post-freeze-development`

The software tree already contains a serious full-vision reference architecture.

`packages/fingerprint` includes:

- `AcousticObjectModelV1` construction from repeated observations;
- fingerprint-to-object-model comparison;
- nuisance characterization;
- specimen-disjoint splitting;
- hard-negative selection;
- Sonic Twin baseline verification;
- ranked Sonic Twin retrieval;
- benchmark-corpus validation;
- isotonic probability calibration;
- group-disjoint held-out calibration evaluation;
- Brier score, expected calibration error, ROC AUC, and risk/coverage reporting;
- algorithm-promotion policy;
- research-only material inference;
- spatial modal sound-field modeling.

`packages/validation` includes:

- `MeasurementRecordV1`;
- `DerivationRecordV1`;
- content addressing and integrity verification;
- artifact envelopes/migration registry;
- capability claims and software-qualification manifests;
- research repository ingestion/integrity checks;
- station calibration;
- Resonance Atlas records and snapshots;
- specimen merges;
- collections and graph projection;
- Atlas registry/search;
- `ResonanceAtlasServiceV1`;
- in-memory conformance adapter.

`packages/dsp` also contains a research-only high-resolution damped-mode estimator (`prony-research`) in addition to frozen `er-dsp-2`.

The web application exposes local software-only `?twin=1` and `?atlas=1` surfaces. They currently use deterministic synthetic/demo data and are explicitly not physical identity evidence or a production network.

### 2.4 What is *not* built or earned yet

The most important gaps are semantic and empirical, not missing UI components:

- no completed physical Gate A2/B/C release sequence;
- no physically grounded nuisance corpus at useful scale;
- no production-grade physical Sonic Twin benchmark;
- no calibrated public same-object probability claim;
- no learned representation proven superior to the deterministic baseline;
- no physically validated spatial sound field;
- no scientifically validated material-identification claim;
- no production Atlas storage/network adapter;
- no public publication/moderation/consent system;
- no canonical consumer physical-object identity;
- no authenticated provenance for Capsules;
- no network-scale specimen merge/deduplication policy supported by calibrated evidence.

The team’s job is to close those gaps without destroying the boundaries that make the current system scientifically interpretable.

---

## 3. Non-negotiable invariants

Every engineer should understand these before changing code.

### 3.1 Scientific interpretation boundary

The current empirical claim is:

> **Estimated audible resonances supported by each recorded transient.**

Do not silently promote this into:

- complete structural eigenmodes;
- material identity;
- physical-object identity;
- calibrated loudness;
- a universal acoustic signature;
- proof that two nearby peaks represent the same physical mode;
- a causal structural model of the object.

### 3.2 Observation != object

A capture is one observation.

A fingerprint is one deterministic analysis of one observation.

An `er1-*` signature is a deterministic signature of a fingerprint subset. It is not a cryptographic authenticity statement and not a canonical physical-object ID.

Two equal signatures remain two observations unless some independent physical identity mechanism binds them.

### 3.3 Product comparison != identity inference

Resonance Diff remains descriptive. Its mutual-nearest frequency pairing is a navigation aid, not an identity score and not proof of shared physical modes.

If a calibrated Sonic Twin verifier is later introduced, it must be a separately versioned derivation with named evaluation population, uncertainty, abstention, and held-out evidence.

### 3.4 PCM privacy boundary

Current public/product contracts keep raw microphone PCM local.

Allowed current exceptions are controlled private review/research artifacts such as Gate B listening companions. Those do not enter schema-v5 evidence, Release Console, public sharing, or Atlas publication.

A future remote raw-audio research corpus would require a separate explicit privacy/consent contract. Do not introduce it as an incidental backend implementation detail.

### 3.5 Measurement immutability

Measurement facts are immutable after capture/analysis under their declared contract.

Changing a renderer, instrument, similarity function, embedding, visualization, calibration model, or Atlas indexing strategy must create a new derivation. It must never rewrite the originating measurement.

### 3.6 Version everything that changes semantics

At minimum, semantic changes require version transitions for:

- acquisition contract;
- fingerprint algorithm;
- evidence/measurement schema;
- renderer;
- instrument/realtime engine;
- similarity algorithm;
- calibration model;
- material-inference model;
- spatial model;
- Atlas record/service contract;
- migration semantics;
- capability/promotion policy.

### 3.7 No learned model before baseline characterization

The deterministic modal baseline must be physically characterized first. Learned models enter only after:

- ground truth exists;
- nuisance behavior is quantified;
- deterministic baselines are frozen;
- train/calibration/evaluation leakage is controlled;
- promotion criteria are predeclared.

### 3.8 Branch separation during active empirical work

During the active v8 physical sequence:

- `main` is empirical authority;
- `freeze/gate-a2-v8-2026-08-25` is immutable;
- product/research engineering belongs on `post-freeze-development` or branches from it;
- do not merge product/research work back into `main`;
- any future empirical software change requires an explicit new qualification/freeze cycle before accepting new empirical evidence.

---

## 4. Repository architecture and ownership boundaries

The current package split is directionally correct and should be preserved.

### 4.1 `packages/acquisition`

Owns browser-independent or browser-adjacent acquisition logic, capture-quality semantics, ring buffer/trigger behavior, and acquisition contracts.

Rules:

- no React dependency;
- no identity inference;
- capture settings must be explicit;
- native sample rate propagates through the pipeline;
- resource ownership must remain explicit and teardown-safe.

### 4.2 `packages/dsp`

Owns deterministic signal analysis.

Rules:

- pure numerical code where possible;
- no DOM, React, storage, network, or product state;
- physical quantities carry units in names;
- canonical algorithms are versioned;
- research estimators remain explicitly research-only until promoted.

### 4.3 `packages/fingerprint`

Owns post-measurement comparison/research semantics:

- recurrence;
- object models;
- nuisance characterization;
- retrieval;
- verification;
- calibration;
- material research;
- spatial models;
- promotion policies.

This package must never make product wording silently stronger than its evidence contract.

### 4.4 `packages/synth`

Owns deterministic offline modal reconstruction.

Raw captured audio must never be mixed into a “model” output.

### 4.5 `packages/instrument`

Owns real-time playable synthesis and note scheduling.

One global frequency ratio should preserve modal geometry during transposition; Nyquist filtering must remain explicit.

### 4.6 `packages/visual`

Owns deterministic visual/presentation derivations such as Acoustic DNA/story structures. Visualization may expose existing measurements but must not create new scientific estimates implicitly.

### 4.7 `packages/validation`

Owns schemas, evidence evaluation, provenance, integrity, repository semantics, Atlas contracts, and assurance.

Keep it as a domain/contracts package. A production backend should implement its interfaces from a separate service/application package instead of putting database/network side effects into the validation domain.

### 4.8 `apps/web`

Owns orchestration and human interfaces.

It should compose package APIs rather than contain duplicate analytical semantics.

### 4.9 Recommended additions

For the next stage, prefer adding:

- `apps/atlas-api` or `services/atlas-api` — production network implementation;
- `packages/atlas-client` — typed client for the Atlas service;
- `packages/research-protocol` — physical benchmark/protocol schemas if they grow beyond `validation`;
- `tools/er-cli` — content hashing, corpus ingestion, integrity verification, benchmark freezing, and report generation.

Do not turn `apps/web` into the storage/backend layer.

---

# PART II — EXECUTION PROGRAM

## 5. Workstream E0 — Engineering takeover, repository governance, and reproducibility

**Priority:** immediate / parallel  
**Empirical dependency:** none, provided frozen refs are untouched

### 5.1 Objectives

Make the repository safe for a larger team and make every future scientific/software promotion reproducible.

### 5.2 Required work

1. Resolve #81 with GitHub branch/ruleset protection:
   - PR-only changes on `main` and `post-freeze-development`;
   - required CI status checks;
   - force-push/deletion disabled;
   - `freeze/*` protected from rewrite/deletion;
   - conversation resolution required.
2. Resolve #82 after an owner-level licensing decision.
3. Keep CODEOWNERS current for acquisition/DSP, empirical validation, research/identity, and backend/security domains.
4. Pin action revisions and frozen dependency installs.
5. Make all qualification reports machine-readable and content-addressed.
6. Add an SBOM/dependency report to software releases.
7. Ensure all versioned artifact schemas have parser/validator tests and migration tests.
8. Add a release checklist requiring exact commit, tree, workflow runs, artifact digests, capability claims, and known exclusions.

### 5.3 Definition of done

- direct unreviewed pushes to authority branches are rejected;
- frozen refs cannot be rewritten;
- license state is explicit;
- a clean checkout of a named revision can run install/typecheck/test/build/qualification using documented commands;
- release artifacts identify the exact revision and claim scope;
- qualification does not imply physical evidence unless physical evidence is explicitly referenced.

---

## 6. Workstream E1 — Complete the frozen physical v8 release sequence

**Priority:** critical path  
**Code branch:** no empirical code changes unless a genuine release-blocking defect forces a deliberate new cycle

This workstream is already specified operationally in #64/#65/#66/#25/#28/#29. Engineers should support execution, not reinterpret it.

### 6.1 #64 — intended-device physical preflight

Use one disposable object permanently excluded from the campaign.

Must verify on the intended collection hardware/browser:

- visible exact v8 revision;
- real microphone permission and physical transducer path;
- room-noise phase and arming;
- negotiated sample rate/channel count/audio-processing settings;
- one physical strike;
- clear analysis or retained failure behavior;
- local evidence export actually materializes;
- schema v5 / exact revision / PCM-free evidence when exported;
- Gate B and Gate C open without microphone request;
- real page departure releases microphone ownership and no stale session returns.

Do not repeat strikes to search for a favorable fingerprint.

### 6.2 #65 — freeze candidate register and campaign manifest

Before any production analysis of candidates:

- create finite physical candidate register;
- bind inventory IDs;
- select exactly twelve roles;
- record physical setup;
- export one canonical `empirical-campaign-1` manifest;
- record `erc1-*` signature and exact-file SHA-256;
- derive deterministic collection order;
- preserve unchanged copies.

### 6.3 #66/#25 — collect and adjudicate Gate A2

For every planned specimen:

- exactly first five acquisition-quality-passing attempts count;
- AQ rejects can retry;
- qualified analytical failures permanently occupy a slot;
- never collect a sixth qualified attempt to rescue a result;
- export schema-v5 evidence;
- preserve exact hashes/copies;
- export attempt-5 private Gate B companion only for passing sessions before closure;
- maintain append-only custody ledger;
- no interim aggregate adjudication;
- complete/account all twelve planned outcomes.

Then adjudicate exactly once in Release Console.

### 6.4 #28 — Gate B

Only after canonical Gate A2 PASS:

- deterministic five-specimen selection;
- two fixed reviewers;
- ten canonical judgments;
- exact attempt-5 target binding;
- companion hash verification;
- A/B blinding;
- no microphone acquisition;
- one canonical adjudication after all reviews.

### 6.5 #29 — Gate C

Only after canonical Gate B PASS:

- deterministic four-specimen selection;
- two fixed reviewers;
- mobile + reference device;
- sixteen judgments;
- exact inherited target;
- fixed device/playback semantics;
- one canonical final adjudication.

### 6.6 Engineering support permitted during E1

Engineers may build **independent verification tooling** on `post-freeze-development`, for example:

- SHA-256 CLI;
- evidence schema verifier;
- custody-ledger checker;
- manifest digest checker;
- file-presence checker.

Such tools must not silently become part of the frozen evidence-production path, modify v8 semantics, or transform evidence bytes. They are verification aids only.

### 6.7 Exit

E1 exits when Gate A2/B/C status is recorded under the frozen contracts, regardless of PASS or failure.

A failure is an experimental result. Do not “complete” E1 by changing thresholds until it passes.

---

## 7. Workstream E2 — Measurement/derivation provenance separation

**Primary tracker:** #45  
**Hard dependency:** do not adopt/migrate this into the physical evidence path until Gate A2 physical collection is locked, except for a genuine Gate B/C provenance blocker

### 7.1 Existing foundation

`MeasurementRecordV1` already content-addresses:

- specimen/session/attempt;
- material metadata;
- acquisition contract;
- exact software revision;
- fingerprint algorithm;
- setup;
- station metadata;
- fingerprint;
- `rawMicrophoneSamplesIncluded: false`.

`DerivationRecordV1` separates renderer/instrument/similarity/embedding/visualization/Atlas derivations from the immutable measurement.

### 7.2 Required production hardening

Build a deterministic evidence-to-measurement ingestion path after collection lock.

For each accepted physical measurement:

1. preserve the original schema-v5 file unchanged;
2. hash exact source bytes;
3. parse and validate under exact historical schema;
4. emit `MeasurementRecordV1` or successor;
5. preserve a source-link record containing original filename, byte digest, source contract, source revision, and conversion-tool revision;
6. verify content address;
7. ingest into a research repository only after integrity checks pass.

### 7.3 Derivation graph V2 requirement

`DerivationRecordV1` points to one `measurementId`. That is sufficient for single-measurement outputs but insufficient for multi-observation object models, calibrators, learned embeddings, corpus-level indexes, or Atlas snapshots.

Introduce a backward-compatible `DerivationRecordV2` or a generic `ArtifactNodeV2` with explicit input sets:

```ts
interface DerivationRecordV2 {
  schemaVersion: 2;
  derivationContractVersion: "derivation-record-2";
  derivationId: string;
  kind: string;
  algorithmVersion: string;
  configDigest: string;
  sourceMeasurementIds: readonly string[];
  sourceDerivationIds: readonly string[];
  sourceDatasetSnapshotIds: readonly string[];
  artifactDigest: string;
  createdAt: string;
}
```

All input arrays must be canonicalized deterministically before hashing.

### 7.4 Canonical serialization

Do not change V1 content-addressing semantics retroactively.

For new V2 artifacts, define one canonical serialization contract. Prefer a standards-based deterministic JSON scheme or a separately versioned `canonical-json-*` implementation. Add official test vectors and cross-runtime conformance tests.

### 7.5 Required CLI

Create an engineer-facing CLI with at least:

- `er verify evidence <file>`;
- `er hash <file>`;
- `er ingest measurement <evidence>`;
- `er verify measurement <record>`;
- `er verify derivation <record>`;
- `er verify repository <snapshot>`;
- `er freeze dataset <manifest>`;
- `er inspect lineage <artifact-id>`.

The CLI must never reserialize source evidence when reporting its original digest.

### 7.6 Exit

One physical measurement can be reused by later renderers, instruments, similarity algorithms, material models, and Atlas publications without rewriting its measurement identity.

---

## 8. Workstream E3 — Physical research corpus and nuisance program

**Priority:** highest research priority after E1 data lock  
**Purpose:** create ground truth needed for Sonic Twin, DSP improvement, spatial modeling, and material research

### 8.1 Core principle

Physical-object ground truth must exist independently of every capture ID, fingerprint, signature, model score, or clustering result.

A specimen registry is established physically first. Acoustic algorithms may evaluate against that registry; they may not define it.

### 8.2 Research observation schema

Every research observation should bind at least:

- `specimenId`;
- `observationId`;
- object family;
- material truth source;
- session/day;
- operator;
- station/device/browser;
- microphone identity when available;
- actual capture settings;
- striker;
- support/suspension;
- microphone distance;
- strike location or spatial coordinate;
- environment/room ID;
- exact measurement/fingerprint algorithm revision;
- acquisition outcome;
- immutable measurement ID when successful.

### 8.3 Ground-truth taxonomy

Keep these separate:

- physical specimen identity;
- object-family label;
- material label(s);
- provenance/ownership;
- user-facing display label.

Composite objects need multi-material or `composite/unknown` semantics instead of forcing one material label.

### 8.4 Nuisance factors to measure

At minimum characterize:

- strike location;
- striker type;
- support/suspension;
- microphone distance;
- room/environment;
- microphone/device/station;
- operator;
- day/session;
- gain/processing settings where controllable;
- object orientation where relevant.

Do not assume any factor is invariant because the mode estimator appears stable on synthetic fixtures.

### 8.5 Corpus stages

The numbers below are **engineering targets for dataset readiness**, not scientific claims or frozen release thresholds.

#### Stage R0 — protocol shakeout

Target:

- >= 24 physical specimens;
- >= 8 object families;
- >= 3 broad material classes;
- >= 10 usable observations/specimen;
- at least two nuisance factors deliberately perturbed for every specimen.

Purpose: verify registry, custody, provenance, station metadata, capture throughput, benchmark freezing, and analysis tooling.

No identity/material product claim may be promoted from R0.

#### Stage R1 — Sonic Twin benchmark

Target:

- >= 100 physical specimens;
- >= 20 usable observations/specimen where practical;
- >= 3 sessions/days for a meaningful subset;
- >= 2 stations/devices for a meaningful subset;
- explicit hard-negative groups containing acoustically similar different specimens;
- enough object-family/material diversity that the benchmark cannot be solved by one trivial class cue.

Purpose: characterize deterministic baseline, nuisance sensitivity, retrieval, verification, calibration, and abstention.

#### Stage R2 — generalization benchmark

Target:

- >= 200 held-out physical specimens not used for model selection;
- >= 1,000 held-out query observations;
- station-disjoint challenge subset;
- object-family-disjoint or unseen-family subset where feasible;
- multiple rooms/devices/operators;
- explicit low-SNR, high-Q, broad, coupled, and near-degenerate specimens.

Purpose: determine whether a physical identity product claim is supportable.

#### Stage R3 — Atlas scale

Target:

- hundreds to thousands of specimens;
- multiple independent collection stations/contributors;
- immutable dataset snapshots;
- automated integrity checks;
- public/private consent state;
- no dependence on one laboratory’s capture chain.

### 8.6 Split policy

At minimum create:

- development/train split;
- calibration split;
- held-out evaluation split;
- station-disjoint challenge split;
- optional object-family-disjoint OOD split.

A physical specimen may never cross a split through a different capture ID.

For calibration, `groupId` should usually be physical specimen identity. No group may cross calibration/evaluation partitions.

### 8.7 Benchmark freeze

Before final model selection/evaluation:

- freeze the corpus manifest;
- content-address exact observation membership;
- record exclusions and reasons;
- freeze ground-truth labels;
- freeze split assignments;
- freeze evaluation metrics;
- prohibit result-driven movement of difficult specimens.

### 8.8 Private research audio

The public measurement/Atlas layer remains PCM-free.

If future DSP research requires retaining raw/trimmed audio, implement a **separate private research-audio vault** with:

- explicit opt-in/collection policy;
- encryption at rest;
- no automatic public synchronization;
- stable link to measurement ID by digest, not by embedding bytes inside public records;
- retention/deletion policy;
- speech/environmental privacy review;
- access logs.

Do not make such a vault a prerequisite for ordinary consumer participation.

### 8.9 Exit

The project has a frozen, physically grounded benchmark that can evaluate identity, nuisance robustness, DSP changes, and material inference without circular labels.

---

## 9. Workstream E4 — DSP research and eventual `er-dsp-3`

### 9.1 Current state

`er-dsp-2` is the frozen empirical fingerprint algorithm. It must remain reproducible indefinitely.

A research-only Prony/high-resolution estimator already exists. It is not a release fingerprint algorithm.

### 9.2 Research question

Determine where the current FFT/peak-tracking/decay-fitting pipeline fails physically, especially under:

- close/overlapping modes;
- near-degenerate structures;
- short decay;
- broad resonances;
- coupled/multi-cluster modes;
- low SNR;
- nonstationary excitation;
- device response differences.

### 9.3 Candidate estimators

Engineers may evaluate:

- higher-resolution parametric damped-sinusoid methods;
- ESPRIT / matrix-pencil families;
- multi-resolution spectral estimators;
- improved robust onset/ringdown segmentation;
- model-order selection;
- uncertainty-aware mode acceptance;
- hybrid FFT + parametric refinement.

Keep every candidate under a research algorithm version.

### 9.4 Evaluation metrics

On synthetic signals with known ground truth:

- frequency error in cents;
- decay error;
- mode precision/recall;
- duplicate-mode rate;
- failure detection;
- deterministic reproducibility;
- runtime/memory.

On physical benchmark data:

- analysis success/failure rate;
- within-specimen recurrence;
- modal-drift distribution;
- hard-negative separation;
- retrieval/verification metrics downstream;
- reconstruction behavior;
- sensitivity by nuisance factor.

### 9.5 Promotion protocol

A candidate cannot become `er-dsp-3` because it looks better on hand-selected objects.

Promotion requires:

1. exact algorithm specification;
2. frozen configuration;
3. synthetic benchmark pass;
4. physical benchmark pre-registration;
5. specimen-disjoint held-out evaluation;
6. no silent regression on current supported regimes;
7. explicit improvement on at least one targeted failure regime;
8. a new fingerprint algorithm version;
9. a migration/compatibility policy for comparisons across `er-dsp-2` and `er-dsp-3`;
10. a new empirical qualification cycle before evidence produced by the new algorithm is called release evidence.

### 9.6 Cross-version rule

Do not merge `er-dsp-2` and `er-dsp-3` fingerprints into one object model unless an explicit cross-version normalization/compatibility method has itself been validated.

The current `AcousticObjectModelV1` can record multiple algorithm versions; production physical benchmarking should initially require a single algorithm version per model/evaluation population.

---

## 10. Workstream E5 — Sonic Twin: deterministic baseline, verification, retrieval, calibration

### 10.1 Definition

A Sonic Twin is a model of a physically grounded specimen built from repeated observations. It is not one fingerprint and not an `er1-*` signature.

### 10.2 Existing baseline components

Reuse and harden the current implementations:

- `buildAcousticObjectModel()`;
- `compareFingerprintToObjectModel()`;
- nuisance characterization;
- specimen-disjoint splitting;
- hard-negative selection;
- `buildSonicTwinIndex()`;
- `retrieveSonicTwin()`;
- `benchmarkSonicTwinRetrieval()`;
- `buildTwinVerificationPairs()`;
- held-out isotonic calibration;
- risk/coverage reporting.

### 10.3 Object-model hardening

Before physical use, add:

- explicit algorithm-version homogeneity rule;
- explicit source measurement IDs, not only observation IDs;
- robust handling of missing/unstable modes;
- per-mode uncertainty summaries;
- nuisance-stratified support;
- object-model content address;
- derivation record linking all source measurements;
- model-quality diagnostics and minimum-support warnings.

Consider a V2 model with per-mode support by station/session/strike region rather than one aggregate support fraction.

### 10.4 Verification semantics

The verifier should output three possible decisions:

- `match`;
- `nonmatch`;
- `abstain`.

A scalar score is not a probability until calibrated on a named population.

Calibrated probability must always carry:

- calibration model ID/version;
- training/calibration population;
- held-out evaluation population;
- similarity algorithm version;
- threshold policy version;
- scope/exclusions.

Never display it as a universal “probability these are the same object.”

### 10.5 Calibration

The existing `sonic-twin-isotonic-calibration-2` logic should remain the reference nonparametric baseline.

For physical calibration:

- fit only on calibration groups;
- evaluate only on disjoint groups;
- include both positive and negative examples;
- freeze thresholds before evaluation;
- report Brier score, ECE, ROC AUC, and risk/coverage;
- bootstrap or otherwise quantify uncertainty around key metrics;
- report metrics by station, family, material, SNR regime, and nuisance subset where sample size permits.

### 10.6 Retrieval

For query-to-Atlas retrieval report at minimum:

- Recall@1;
- Recall@K;
- mean reciprocal rank;
- query coverage/abstention;
- top-candidate margin;
- failure examples.

Hard-negative retrieval sets are mandatory. Random easy negatives are insufficient.

### 10.7 Production-readiness floor

The current software `similarity-promotion-policy-1` is a development policy, not a sufficient physical product-claim threshold by itself.

Before a consumer identity claim, freeze a **physical Sonic Twin promotion policy** on an R2-scale held-out benchmark. The policy must specify:

- minimum held-out specimen/query counts;
- required station/device diversity;
- confidence intervals;
- maximum acceptable false-match risk at chosen coverage;
- minimum nonmatch performance;
- calibration-quality bounds;
- OOD/unknown behavior;
- regression limits versus deterministic baseline;
- abstention requirements.

Do not invent these numbers after seeing the final held-out result. Pilot data may be used to choose them; final evaluation data may not.

### 10.8 Learned representations

Only after deterministic baseline characterization may engineers train learned models.

Candidate directions include:

- set encoders over modal parameters;
- graph/set transformers over modal relationships;
- nuisance-conditioned embeddings;
- contrastive models using physical specimen IDs as supervision;
- multimodal audio/visual object representations;
- raw-audio models only under the private research-audio contract.

Every learned candidate must be evaluated on the exact same held-out population as the baseline.

Use `evaluateSimilarityAlgorithmPromotion()` or a stricter successor. A learned model is not promoted if it improves one metric while silently degrading calibration, coverage, or retrieval elsewhere beyond the frozen policy.

### 10.9 Exit

A Sonic Twin exits research-only status only when same-object verification and retrieval have quantified held-out performance, calibrated uncertainty, meaningful abstention, documented failure modes, and evidence that survives station/device nuisance.

---

## 11. Workstream E6 — Station calibration and capture-domain control

### 11.1 Why

A network-scale acoustic system will fail if microphone/station effects are treated as invisible. Device and capture provenance must become first-class.

### 11.2 Existing foundation

`StationCalibrationProtocolV1` and station-calibration evaluators already exist in `packages/validation`.

### 11.3 Required physical protocol

Create one or more stable reference objects with externally tracked identity and reproducible setup.

A station qualification should bind:

- station ID;
- device/microphone description;
- OS/browser/runtime;
- negotiated capture settings;
- reference-object model ID;
- setup contract;
- protocol digest;
- observations;
- coverage/drift metrics;
- pass/open verdict;
- timestamp/expiry policy.

### 11.4 Calibration semantics

Station qualification answers a scoped question such as:

> Does this station reproduce the declared reference-object modal structure within the frozen station protocol?

It does not calibrate absolute loudness and does not make devices globally equivalent.

### 11.5 Network policy

Atlas/Sonic Twin observations should carry station status:

- `qualified`;
- `unqualified`;
- `unknown`;
- `expired`.

Do not discard unqualified observations automatically; preserve them with their status so robustness can be studied.

### 11.6 Exit

Cross-device evaluation can distinguish model failure from station/capture-chain drift and can audit the provenance of every network measurement.

---

## 12. Workstream E7 — Spatial Modal Sound Field / object-level acoustic field

### 12.1 Existing foundation

`SpatialModalSoundFieldV1` already separates relatively stable modal frequency/decay estimates from strike-location-dependent excitation amplitudes.

Its current outputs are research predictions and `evidenceEligible: false`.

### 12.2 Physical data model

For objects where spatial modeling is meaningful, add a coordinate frame:

- normalized 2D/3D object coordinates;
- or registered image/mesh coordinates;
- or a declared discrete strike-region map when geometry capture is unavailable.

Every spatial observation binds strike point, support condition, station, and measurement ID.

### 12.3 Model goals

Predict from strike location:

- which stable modes are excited;
- relative modal amplitudes;
- uncertainty/support at the query point;
- expected fingerprint-derived reconstruction.

Do not treat predicted fingerprints as measurements.

### 12.4 Evaluation

Use held-out strike positions and report:

- modal frequency consistency;
- mode-presence precision/recall;
- relative-amplitude error in dB;
- correlation/rank agreement of modal excitation;
- interpolation distance to nearest training strike;
- uncertainty versus error;
- optional blinded perceptual reconstruction quality.

### 12.5 Visual conditioning

A future multimodal model may use multi-view images, depth, or meshes to improve spatial prediction. That should be a separately versioned derivation and benchmarked against the nonvisual spatial baseline.

### 12.6 Exit

The project has a physically validated object-level acoustic field for at least a meaningful subset of objects, with clear uncertainty and no confusion between predicted and observed fingerprints.

---

## 13. Workstream E8 — Material inference program

### 13.1 Claim separation

Material inference is **not** a consequence of Sonic Twin identity.

A system can identify repeated observations of one object while being poor at material classification, and vice versa.

### 13.2 Existing baseline

`material-centroid-research-1` exists as a deliberately simple research baseline with:

- object-model summary features;
- centroid classification;
- abstention by distance margin;
- `evidenceEligible: false`;
- no calibrated probability.

Keep it as the baseline to beat.

### 13.3 Ground truth

Material labels must have source provenance, for example:

- manufacturer/specification;
- direct physical inspection;
- expert annotation;
- self-declared/uncertain;
- inferred.

Do not write an inferred material label back as ground-truth metadata.

Composite objects must support multiple constituents or explicit `composite/unknown` status.

### 13.4 Anti-shortcut evaluation

Material models can cheat by learning object family, geometry, striker, or station artifacts.

Therefore evaluation must include:

- specimen-disjoint split;
- object-family-disjoint challenge split where possible;
- station/device checks;
- balanced or stratified material reporting;
- hard confusions such as ceramic/glass, metals with different geometries, polymers/wood/composites where data supports them.

### 13.5 Metrics

Report at minimum:

- macro F1;
- balanced accuracy;
- per-class precision/recall;
- confusion matrix;
- coverage when abstention is enabled;
- covered accuracy;
- calibration metrics if probabilities are introduced;
- OOD abstention behavior;
- performance by object family/station.

### 13.6 Model progression

Recommended sequence:

1. existing centroid baseline;
2. regularized classical classifiers on physically interpretable modal features;
3. set/graph models over modal parameters;
4. nuisance-conditioned models;
5. multimodal visual/acoustic models;
6. raw-audio learned models only if the private research-audio program justifies them.

### 13.7 Promotion

Before any consumer material label is shown as an inference:

- freeze a material taxonomy;
- freeze a material benchmark snapshot;
- preregister promotion thresholds;
- evaluate on an untouched held-out set;
- require meaningful abstention for unsupported/OOD cases;
- version the inference algorithm and calibration;
- expose the population/scope of the claim.

The phrase “hear what it is made of” remains directional until this program supports it.

---

## 14. Workstream E9 — Resonance Atlas production service

### 14.1 Current state

The repository has a complete **local reference contract**, not a production network:

- `ResonanceAtlasRecordV1`;
- content-addressed snapshots;
- registry/search;
- specimen merges;
- collections/graph;
- repository integrity checks;
- `ResonanceAtlasServiceV1`;
- `MemoryResonanceAtlasServiceV1`;
- service-conformance tests;
- a synthetic `?atlas=1` demo.

### 14.2 Architecture

Implement a production adapter outside `packages/validation`.

Recommended layering:

`web / CLI -> typed Atlas client -> Atlas API -> contract verification -> persistent store / derived indexes`

The API must accept only artifacts that pass contract and content-address verification.

### 14.3 Minimum service contract

The production implementation must preserve `ResonanceAtlasServiceV1` semantics:

- idempotent publish by content address;
- exact read-back;
- deterministic search semantics for contract-defined fields;
- immutable snapshots;
- record count consistency.

Add versioned network endpoints without weakening the domain contract.

A reasonable HTTP mapping is:

- `POST /v1/atlas/records`;
- `GET /v1/atlas/records/:atlasRecordId`;
- `GET /v1/atlas/search`;
- `POST /v1/atlas/snapshots`;
- `GET /v1/atlas/snapshots/:snapshotId`;
- `POST /v1/atlas/collections`;
- `POST /v1/atlas/specimen-merges`.

Every response should expose the contract version and content address.

### 14.4 Persistent data model

Store immutable canonical payloads separately from mutable operational overlays.

Canonical/content-addressed tables or collections:

- measurements;
- derivations;
- Atlas records;
- specimen-merge records;
- collections;
- snapshots;
- model/calibration artifacts.

Mutable overlays:

- moderation state;
- account/contributor preferences;
- visibility state;
- abuse/rate-limit state;
- deletion/tombstone requests where legally required;
- derived search indexes.

Never mutate an immutable record in place to “correct” history. Publish a new artifact or overlay event.

### 14.5 Observation-level publication gap

`ResonanceAtlasRecordV1` is specimen-centric. That is appropriate for controlled research, but an open consumer network must not require a user to assert canonical physical identity.

Add a V2 public model that separates:

- **PublicObservationRecord** — one capture/measurement, no canonical object identity claim;
- **SpecimenRecord** — an externally grounded or explicitly user-grouped physical specimen;
- **SpecimenMembershipAssertion** — a versioned assertion connecting observations to a specimen with provenance/assurance level.

Do not implement consumer deduplication by `er1-*` signature.

### 14.6 Provenance/assurance levels

Every public specimen/identity relation should expose an assurance class, e.g.:

- `self-declared`;
- `controlled-physical-registry`;
- `calibrated-sonic-twin-supported`;
- `independently-reviewed`.

The exact taxonomy should be versioned. Search/UI must not visually flatten all classes into the same certainty.

### 14.7 Derived acoustic index

Metadata search can launch before identity inference.

Acoustic nearest-neighbor search should be a derived, rebuildable index with:

- algorithm version;
- embedding/similarity derivation ID;
- calibration ID when probabilistic semantics are displayed;
- source snapshot ID;
- rebuild reproducibility.

An index result must not itself merge specimens.

### 14.8 Privacy

Public Atlas publication must remain PCM-free by default.

The service may store:

- fingerprints;
- measurement/provenance metadata approved for publication;
- derived visual/model artifacts;
- contributor metadata under consent;
- content-addressed references.

Do not upload microphone audio as an implementation shortcut.

### 14.9 Moderation and abuse

Before public launch implement:

- report/takedown workflow;
- rate limiting;
- contributor/account abuse controls;
- content visibility overlays;
- explicit consent for publication;
- private/unlisted/public states;
- audit trail for moderation actions;
- handling for offensive labels/descriptions;
- no automatic publication of location or sensitive metadata.

### 14.10 Conformance

Every production adapter must pass the same service-conformance suite as the in-memory reference plus persistence-specific tests:

- restart durability;
- concurrent idempotent publish;
- transaction rollback;
- canonical byte preservation;
- snapshot repeatability;
- migration compatibility;
- authorization boundaries;
- rate-limit behavior;
- malformed-artifact rejection.

### 14.11 Exit

Atlas has a production network implementation that preserves content-addressed semantics, privacy boundaries, consent, moderation, and explicit uncertainty/identity provenance.

---

## 15. Workstream E10 — Participation and network effects

### 15.1 Product objective

The network should amplify physical discovery, not become a generic feed.

The desired loop is:

`I strike -> I discover -> I send/publish -> you hear/play -> you try something -> you contribute`

### 15.2 Pre-identity network features

These can ship before calibrated physical-object identity:

- observation publication;
- Acoustic Capsules;
- collections of observations;
- themed challenges;
- “try this near you” prompts;
- contributor pages;
- curated resonance galleries;
- geographic aggregation only with explicit coarse-location consent;
- tags/object-family metadata;
- public Acoustic DNA and model playback.

### 15.3 Identity-dependent features

Hold until Sonic Twin is calibrated:

- “same object” auto-linking;
- automatic specimen deduplication;
- public object identity confidence;
- object-history merging;
- provenance claims based solely on acoustic similarity;
- twin-based canonical naming.

### 15.4 Collections

Collections should be explicit user/curator groupings. Membership means “included in this collection,” not “same physical object.”

Examples:

- objects in one kitchen;
- bells;
- glass objects;
- city sound challenge;
- objects with unusually long ringdown;
- one museum’s controlled specimens.

### 15.5 Challenges

Challenges are a high-value growth primitive because they encourage new physical measurements.

A challenge definition should contain:

- challenge ID/version;
- prompt;
- start/end;
- allowed artifact types;
- publication/consent rules;
- optional physical protocol;
- ranking criteria if any;
- explicit statement of whether results are scientific, playful, or both.

Do not use unvalidated identity/material inference as a contest truth label.

### 15.6 Social graph

The graph must contain explicit edges only, such as:

- contributor -> published observation;
- contributor -> collection;
- collection -> observation;
- observation -> measurement;
- specimen -> controlled membership assertion;
- record -> derivation;
- response observation -> challenge.

Do not create a “same-object” graph edge merely because similarity exceeds a heuristic threshold.

### 15.7 Telemetry

When telemetry is introduced, optimize the physical discovery loop:

- landing -> successful reveal;
- reveal -> hear/play;
- share -> recipient hear/play;
- recipient -> `TRY YOUR OWN`;
- successful user -> second strike;
- saved observation -> reopen;
- collection/challenge -> new physical capture.

Telemetry should be minimal, consent-aware, and must never require raw microphone content.

---

## 16. Workstream E11 — Consumer Product V2

### 16.1 Preserve simplicity

The consumer product should remain much simpler than the research system.

One dominant action per stage remains the rule.

Do not expose calibration jargon, provenance graphs, release gates, or benchmark terminology on the ordinary first-use path.

### 16.2 Product architecture

Keep separate route bundles for:

- consumer;
- campaign/release tooling;
- Sonic Twin lab;
- Atlas lab/admin.

Prefer lazy loading/code splitting so research/admin code does not inflate the first-strike bundle.

### 16.3 Performance budgets

Treat mobile as reference.

Suggested engineering budgets:

- no horizontal overflow at 360 px and 390 px widths;
- interactive controls >= approximately 44 px touch geometry;
- root consumer JS gzip kept below ~150 kB unless measured evidence justifies an increase;
- research/admin routes lazy-loaded;
- no microphone request before explicit user action;
- no microphone reacquisition for saved/shared playback;
- no blank state after recoverable failure.

These are product budgets, not empirical thresholds.

### 16.4 Publication UX

When Atlas publication becomes available:

1. keep local capture successful first;
2. offer “publish/share” as a separate explicit action;
3. show exactly what metadata will leave the device;
4. default raw audio to excluded;
5. allow observation publication without asserting canonical object identity;
6. allow unlisted/public visibility;
7. show material/identity inference only when its assurance level supports it.

### 16.5 Offline/PWA

The core strike/reveal/play path should remain usable with minimal network dependence once the application is loaded.

A PWA/offline shell is compatible with the local-first model and should be considered before adding mandatory accounts.

### 16.6 Accessibility

Retain:

- keyboard navigation;
- focus visibility;
- reduced-motion support;
- semantic labels;
- usable touch targets;
- screen-reader interpretation of key measurement summaries;
- nonvisual alternatives to Acoustic DNA.

---

## 17. Workstream E12 — Assurance, capability promotion, and claims

### 17.1 Existing foundation

`CapabilityClaimV1` and `SoftwareQualificationManifestV1` already exist.

Use them as the nucleus of a strict promotion system.

### 17.2 Promotion principle

Every promoted capability must bind:

- one exact proposition;
- one software/model version;
- scope/population;
- exclusions;
- source artifacts;
- evidence domain;
- evaluation metrics;
- trust boundary;
- review state.

### 17.3 Suggested maturity ladder

For every major capability:

1. `prototype` — code exists;
2. `software-qualified` — deterministic tests/CI pass;
3. `synthetic-qualified` — known-ground-truth digital stress pass;
4. `physical-research` — evaluated on physical development data;
5. `held-out-validated` — frozen independent evaluation passes;
6. `product-eligible` — wording/UX/privacy/governance approved;
7. `released` — named version deployed with evidence bundle.

Do not skip from software-qualified to released for a physical claim.

### 17.4 Claim registry

Create a repository-visible claim registry for at least:

- resonance estimation;
- reconstruction fidelity;
- playable identity/timbre;
- station qualification;
- Sonic Twin retrieval;
- Sonic Twin verification;
- spatial prediction;
- material inference;
- Atlas integrity;
- Atlas network conformance.

Each claim entry should link to exact evidence and state what it does **not** establish.

### 17.5 Independent review

Before a high-stakes scientific claim becomes product-facing, require review by someone who did not implement the evaluated algorithm. Review may be internal initially; external reproduction can be added later.

---

# PART III — DATA AND API SPECIFICATIONS

## 18. Measurement lineage model

The mature lineage should be:

`physical specimen -> interaction -> capture -> immutable measurement -> derivation(s) -> object model -> calibrated inference -> Atlas/publication`

Never collapse this into “object -> fingerprint.”

### 18.1 Identity domains

Use distinct identifiers:

- `specimenId` — externally tracked physical specimen;
- `interactionId` — one physical strike/interaction context if introduced;
- `captureId` / observation ID — one captured transient;
- `sessionId` — one collection session;
- `attemptId` — attempt within session;
- `measurementId` — content address of immutable measurement record;
- `derivationId` — content address of derived artifact;
- `objectModelId` — content address of multi-observation model;
- `atlasRecordId` — content address of publication record.

Do not reuse one namespace across these semantics.

### 18.2 Material metadata provenance

Material fields should evolve from a bare label to:

```ts
interface MaterialAssertionV1 {
  materialLabel: string;
  source: "manufacturer" | "inspection" | "expert" | "self-declared" | "inferred" | "unknown";
  sourceReference: string | null;
  confidenceClass: "verified" | "declared" | "uncertain" | "inferred";
  algorithmDerivationId: string | null;
}
```

An inferred label must carry the inference derivation and must not overwrite verified truth.

### 18.3 Identity assertion model

For an open network, use explicit assertions:

```ts
interface SpecimenMembershipAssertionV1 {
  assertionId: string;
  observationOrMeasurementId: string;
  specimenId: string;
  basis: "controlled-registry" | "user-declared" | "calibrated-sonic-twin" | "reviewed-merge";
  algorithmDerivationId: string | null;
  calibratedProbability: number | null;
  calibrationModelId: string | null;
  createdAt: string;
}
```

This prevents one opaque “object ID” from hiding how identity was established.

---

## 19. Sonic Twin benchmark contract

A production benchmark snapshot should contain:

- snapshot ID/content digest;
- observation membership;
- physical specimen registry digest;
- algorithm version used to produce measurements;
- split map;
- nuisance metadata;
- hard-negative definitions;
- excluded observations + reasons;
- query set;
- gallery/index set;
- verification-pair set;
- calibration population;
- held-out evaluation population;
- metric definitions;
- promotion-policy version.

The benchmark itself is an immutable artifact. Adding data creates a new snapshot.

---

## 20. Atlas API security contract

### 20.1 Validation before persistence

Reject:

- malformed schema;
- unsupported contract version;
- invalid digest;
- digest/payload mismatch;
- duplicate IDs with different bytes;
- raw PCM fields in PCM-free public artifacts;
- invalid derivation references;
- unauthorized specimen merges;
- publication without required consent state.

### 20.2 Authentication vs provenance

Account authentication proves who controls an account. It does not prove physical specimen identity or scientific provenance.

Keep account authentication, artifact content addressing, and physical specimen assurance separate.

### 20.3 Immutability

If the same content address is published twice with identical bytes, publication is idempotent.

If different bytes are presented under the same claimed digest, reject and log a security/integrity event.

### 20.4 Deletion

Because public/legal deletion may be required, use tombstone/visibility overlays while retaining internal integrity where legally permissible. Do not mutate old content-addressed bytes into different bytes under the same ID.

---

# PART IV — TESTING AND RELEASE

## 21. Required test pyramid

### 21.1 Unit tests

Every package owns deterministic unit tests for pure semantics.

### 21.2 Property/invariant tests

Add property tests for:

- canonical serialization/content IDs;
- score monotonicity where mathematically required;
- permutation invariance of set-based models;
- no duplicate mode assignment;
- no cross-split specimen leakage;
- idempotent Atlas publication;
- specimen merge transitivity rules;
- raw PCM exclusion from public artifacts.

### 21.3 Synthetic acoustic tests

Maintain digital-twin tests across:

- ordinary;
- short-decay;
- broad;
- coupled;
- high-Q;
- low-SNR;
- near-degenerate;
- gain;
- excitation tilt;
- damping variation;
- hard negatives;
- explicit failure cases.

Every report keeps `releaseGateEquivalent: false` or equivalent semantics.

### 21.4 Browser E2E

Keep mobile E2E for:

- first strike;
- permission denial/recovery;
- history/reopen;
- compare;
- Capsules;
- lifecycle/pagehide;
- campaign author/collector;
- Release Console;
- Gate B/C;
- Atlas publication once implemented.

### 21.5 Backend conformance

Production Atlas adapters must run the reference service conformance suite against an ephemeral real datastore in CI.

### 21.6 Physical regression suite

After E3, establish a small controlled physical regression set separate from final held-out research evaluation.

Use it to detect device/DSP regressions, not to tune final evaluation claims.

### 21.7 No benchmark contamination

Final held-out specimens are never used for:

- threshold tuning;
- feature design after inspection;
- error-driven algorithm edits;
- station-specific normalization fitting.

If contamination occurs, create a new held-out set or downgrade the claim.

---

## 22. CI lanes

Maintain distinct lanes:

### Lane A — ordinary CI

- install;
- typecheck;
- unit tests;
- build;
- browser smoke/E2E.

### Lane B — digital-twin qualification

- deterministic acoustic stress;
- digital full-stack system;
- explicit non-physical boundary.

### Lane C — full-vision software qualification

- whole repository;
- provenance;
- calibration;
- Atlas;
- browser/lifecycle;
- machine-readable capability manifest.

### Lane D — physical benchmark evaluation

Triggered manually or on named research releases only. It must consume a frozen dataset snapshot and emit a content-addressed report. Do not run final held-out physical evaluation on every exploratory commit.

### Lane E — Atlas production conformance/security

Once backend exists:

- datastore migration test;
- contract conformance;
- idempotency;
- authorization;
- rate limits;
- security scans;
- backup/restore test.

---

# PART V — PARALLELIZATION AND MILESTONES

## 23. What can happen in parallel now

While the physical v8 sequence is being performed, engineers can safely work on `post-freeze-development` on:

- repository governance/tooling;
- test infrastructure;
- Atlas production adapter behind a nonpublic feature flag using synthetic records;
- Atlas client/API contracts;
- moderation/consent architecture;
- consumer code splitting/performance/accessibility;
- benchmark tooling and registry schemas that do not alter the active empirical contract;
- private research-corpus tooling using clearly noncampaign objects;
- DSP research on synthetic or separate noncampaign data;
- qualification/assurance infrastructure.

However, respect #45: do not adopt a new provenance migration for active v8 evidence before the Gate A2 physical collection is locked.

Do not use campaign candidate objects for research auditioning before #65 freeze.

---

## 24. Dependency graph

The intended graph is:

```text
E0 governance/reproducibility -------------------------------> continuous

E1 v8 physical release
   #64 -> #65 -> #66/#25 -> #28 -> #29

Gate A2 collection locked
   -> E2 measurement/derivation provenance adoption
   -> E3 physical research corpus
        -> E4 DSP candidate evaluation
        -> E5 Sonic Twin physical benchmark/calibration
        -> E6 station qualification
        -> E7 spatial sound field
        -> E8 material inference

E2 + E3 + E5 semantic foundation
   -> E9 production Resonance Atlas
        -> E10 participation/network
        -> E11 consumer publication experience

All major promotions
   -> E12 assurance/claim registry
```

Backend implementation may begin earlier with synthetic data, but public identity-dependent behavior stays blocked on E5.

---

## 25. Milestone definitions

### M0 — Engineer takeover complete

- this spec merged;
- #90 active coordination tracker;
- CI green on product trunk;
- engineers can reproduce build/tests;
- authority boundaries understood.

### M1 — Empirical v8 resolved

- #64/#65/#66/#25/#28/#29 completed as far as evidence permits;
- failures preserved;
- no threshold gaming.

### M2 — Physical measurement repository

- v8 physical evidence ingested immutably after lock;
- source bytes/digests preserved;
- measurement/derivation lineage works;
- CLI/repository integrity pass.

### M3 — Physical benchmark R1

- >=100-specimen benchmark target reached or documented equivalent design;
- nuisance metadata complete;
- hard negatives;
- frozen development/calibration/evaluation snapshots.

### M4 — Sonic Twin research baseline

- deterministic object model evaluated physically;
- retrieval/verification/calibration/risk-coverage reports;
- station/nuisance breakdowns;
- no public identity claim yet unless promotion policy passes.

### M5 — Next DSP decision

- er-dsp-2 failure map documented;
- research candidates compared;
- either retain er-dsp-2 or formally promote a new version with a new empirical cycle.

### M6 — Atlas service alpha

- production adapter passes service conformance;
- content-addressed persistent records/snapshots;
- observation-level publication model;
- consent/moderation/privacy implemented;
- synthetic/private alpha only.

### M7 — Physical Sonic Twin validation

- R2 held-out benchmark frozen;
- promotion policy frozen before evaluation;
- calibrated performance and uncertainty reported;
- claim either promoted with scope or explicitly remains research-only.

### M8 — Resonance Atlas public beta

- public observation publishing;
- PCM-free by default;
- contributor/collection/challenge primitives;
- no unsupported automatic specimen identity;
- reproducible Atlas snapshots.

### M9 — Material/spatial research promotion decision

- spatial field validated or retained research-only;
- material benchmark completed;
- material claim promoted only if independent held-out evidence supports it.

### M10 — Full vision

The system supports, with explicit provenance and uncertainty:

- physical strike -> resonance measurement;
- reusable immutable measurement;
- acoustic reconstruction and instrument;
- repeated-observation acoustic object model;
- calibrated retrieval/verification where earned;
- station-aware provenance;
- optional spatial acoustic field;
- material inference where earned;
- privacy-preserving Atlas publication;
- collections/challenges/network participation;
- reproducible snapshots and derivation lineage;
- no hidden collapse of observation, model, specimen, identity, or inference semantics.

---

# PART VI — ENGINEERING DECISIONS TO PRESERVE

## 26. Do not replace these good decisions casually

1. **Local-first microphone handling.** The project gains trust and architectural clarity from not treating microphone audio as default cloud data.
2. **Deterministic DSP baseline.** It provides an interpretable benchmark for every future learned model.
3. **Exact software revision in evidence.** Keep it.
4. **Content-addressed measurement/derivation/Atlas artifacts.** This is foundational for scientific reproducibility.
5. **Separate physical specimen identity from capture signatures.** This prevents the most dangerous semantic shortcut in the project.
6. **Abstention as a first-class outcome.** Unknown is better than fabricated certainty.
7. **Complete outcome accounting.** Failed and missing observations are evidence, not garbage.
8. **Software qualification != physical evidence.** Keep this distinction visible in code, reports, and UI.
9. **Product simplicity over operator-console complexity.** The science can be deep while first use stays simple.
10. **Network effects after semantic foundations.** The Atlas should scale trustworthy observations, not amplify a mistaken identity convention.

---

## 27. Known architectural risks engineers should attack

### Risk A — single-capture fingerprint overinterpretation

Mitigation: repeated-observation object models, nuisance characterization, scoped claims.

### Risk B — station/device shortcut

Mitigation: station provenance, station-disjoint benchmarks, reference-object qualification.

### Risk C — object-family shortcut in material inference

Mitigation: family-disjoint challenge splits and confusion analysis.

### Risk D — benchmark leakage

Mitigation: immutable specimen registry and content-addressed split snapshots.

### Risk E — Atlas identity collapse

Mitigation: observation-level publication + explicit membership assertions + assurance levels.

### Risk F — learned model hides failure mechanisms

Mitigation: deterministic baseline, promotion comparison, OOD/risk-coverage reporting, derivation/version provenance.

### Risk G — schema evolution breaks content addresses

Mitigation: immutable historical parsers, versioned canonical serialization, explicit migration envelopes.

### Risk H — raw audio gradually leaks into cloud architecture

Mitigation: public schemas hard-code PCM exclusion; any research-audio system is separate, opt-in, and audited.

### Risk I — research UI accidentally becomes consumer claim

Mitigation: route/feature separation, maturity registry, evidence-eligible flags, product-copy review.

### Risk J — empirical freeze is accidentally polluted by normal product work

Mitigation: branch protection, CODEOWNERS, no reverse merge, explicit new empirical version cycle.

---

## 28. First two weeks for a new engineering team

### Week 1

- reproduce `post-freeze-development` at exact handoff head;
- run install/typecheck/test/build and inspect qualification workflows;
- read README, PRODUCT, SPEC, DSP, FULL_VISION_SOFTWARE, DIGITAL_TWIN_QUALIFICATION, and this document;
- read #86/#64/#65/#66/#25/#28/#29/#45/#81/#82/#90;
- assign code owners by package;
- resolve/implement branch protection if permissions permit;
- decide license path with project owner;
- build or verify the `er` engineering CLI skeleton;
- map every existing software-only Twin/Atlas type to this roadmap;
- do not change empirical main.

### Week 2

In parallel:

- support the real #64 physical preflight;
- prepare E3 research-registry/corpus schemas using noncampaign objects only;
- design the Atlas persistent adapter and observation-level V2 publication model;
- add production-adapter conformance harness;
- harden object-model content addressing and physical-benchmark reporting on research branches without claiming physical validation;
- define the physical Sonic Twin benchmark preregistration template;
- define material-label provenance taxonomy;
- profile/lazy-load consumer vs research routes;
- create capability-claim registry skeleton.

No team should spend these two weeks redesigning Acoustic DNA, rewriting the DSP from scratch, or merging the research trunk into empirical `main`.

---

## 29. Final engineering doctrine

The true vision is not a website that produces a pretty spectrum and not a database of hashes.

The durable system is an evidence-preserving chain from a physical interaction to an observation, from observations to a model, from models to calibrated inferences, and from those artifacts to a network that never forgets the distinction between what was measured and what was inferred.

The project should eventually make an extraordinary interaction feel simple:

> hit something, see its acoustic structure, hear it reconstructed, play it, compare it, discover related things, and contribute it to a living map of how physical objects ring.

The engineering standard is that every step underneath that experience remains reproducible, privacy-aware, content-addressed where appropriate, explicit about uncertainty, and scoped to the evidence that actually supports it.

When deciding whether to ship a capability, ask:

1. What exact proposition does this feature imply to a user?
2. What artifact or model produced it?
3. What physical ground truth supports it?
4. What nuisance conditions were tested?
5. What population is the result calibrated for?
6. What does the system do when it does not know?
7. Can the result be reproduced from immutable source artifacts?
8. Does publishing it expose anything that the local-first privacy contract said would remain local?

If those questions have precise answers, the project is moving toward the true vision. If they do not, keep the feature in the lab until they do.
