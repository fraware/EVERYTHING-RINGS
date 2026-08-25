# Capability claim registry

Human-readable index of EVERYTHING RINGS capabilities and the maturity ladder that binds them. Machine-readable capability registry and assurance objects live in `packages/validation` and are owned by the validation/assurance lane. This document does not change those contracts.

Software qualification never implies physical evidence. A green CI run, SBOM, digital-twin report, local Atlas service test, or synthetic benchmark is not Gate A2/B/C, microphone validation, physical-object identity, or material identity.

## Maturity ladder

Physical and product-facing scientific claims must not skip rungs:

`prototype → software-qualified → synthetic-qualified → physical-research → held-out-validated → product-eligible → released`

| Rung | Meaning | Typical evidence domain |
|------|---------|-------------------------|
| prototype | Code exists; no qualification artifact required | none / software |
| software-qualified | Named revision passed frozen software tests | software |
| synthetic-qualified | Named synthetic/digital-twin population characterized | digital-twin |
| physical-research | Physical observations collected under a protocol; not a product claim | physical |
| held-out-validated | Preregistered held-out physical (or declared non-physical) evaluation passed | physical / human-perceptual / playback-transducer as declared |
| product-eligible | Independent review (reviewer ≠ implementer) accepted the claim for product copy | as declared |
| released | Shipped under that exact proposition, version, population, and exclusions | as declared |

The machine-readable capability registry is the implementation authority for maturity transitions. Older `CapabilityClaimV1` assurance objects remain valid only within their own contract semantics; do not infer a higher rung from a less expressive historical enum.

## Claim fields

Each capability binds:

- exact proposition;
- algorithm / contract version;
- population (or `none — software only`);
- exclusions—what it does **not** establish;
- source artifacts / evidence domain;
- metrics if any;
- trust boundary;
- review state;
- current ladder rung.

## Registry

Rungs below are the highest currently earned. They are not aspirations.

| Capability | Proposition | Version / contract | Population | Current rung | Exclusions |
|------------|-------------|--------------------|------------|--------------|------------|
| Resonance estimation | Estimated audible resonances supported by each recorded transient under the canonical baseline | `er-dsp-2` | software path; physical campaign not yet closed | **software-qualified** | Not complete structural eigenmodes, not object identity, not a universal signature, not proof nearby peaks are the same physical mode |
| Reconstruction | Modal reconstruction synthesizes estimated modes from a fingerprint; recorded PCM is not mixed into the model | canonical modal renderer | software | **software-qualified** | Not calibrated loudness; not a physical playback-chain claim |
| Playable instrument | Chromatic instrument is synthesized from the fingerprint-derived modal model | modal instrument | software / consumer path | **software-qualified** | Not authenticity; not a canonical object ID; not Gate C physical playback evidence |
| Browser consumer loop | STRIKE → REVEAL → HEAR → PLAY executes through the browser journey under synthetic/browser-injected audio | consumer web | CI browser qualification | **software-qualified** | Not a physical microphone path; not Gate A2 |
| Station qualification | Versioned station protocols, status records, and evaluators exist and verify their software contracts | station-calibration contracts | digital-station tests only | **software-qualified** | Does not establish that a real station reproduces a reference specimen |
| Twin retrieval | Deterministic retrieval ranks specimens in named digital benchmark populations | Sonic Twin index / deterministic baseline | built-in digital qualification populations | **synthetic-qualified** | Not physical-object identity; not a consumer same-object score |
| Twin verification | Match / nonmatch / abstain comparison and held-out calibration contracts execute on disjoint digital groups | `sonic-twin-isotonic-calibration-2` + baseline | digital held-out groups | **synthetic-qualified** | Calibrated probability is not a universal physical same-object probability |
| Spatial prediction | A spatial modal field predicts a fingerprint at a modeled strike point | spatial field V1 | software | **software-qualified** | Predicted fingerprints are `evidenceEligible: false` and are never measurements |
| Material inference | Modal-summary centroid baseline performs research-only material prediction with abstention | `material-centroid-research-1` | software research tests | **prototype** | `evidenceEligible: false`; `calibratedProbability: null`; not a physical material-identification claim |
| Measurement provenance | Content-addressed measurement records preserve acquisition/fingerprint identity; downstream derivations can be single-source V1 or multi-source V2, with explicit measurement source links | `measurement-record-1`, derivation V1/V2, measurement-source-link | software | **software-qualified** | No physical corpus has yet been migrated under this post-freeze model; content integrity does not prove physical truth |
| Artifact integrity | Artifact envelopes and verification tooling detect payload mutation and compute exact-byte SHA-256 digests | artifact envelope contracts + `er-cli` | software | **software-qualified** | Hashing proves byte identity, not scientific validity; independent tooling is not the frozen v8 evidence-production path |
| Atlas V1 integrity | Content-addressed Atlas records, snapshots, collections, merges, and registry integrity detect software-level mutation | Atlas V1 contracts | software | **software-qualified** | Not a production network; not proof that asserted specimen metadata are physically true |
| Atlas V2 semantics | Public observations, externally grounded specimen records, membership assertions, and assurance levels are versioned and independently verifiable | Atlas V2 contracts | software | **software-qualified** | Does not infer membership from fingerprint equality or similarity; no public corpus claim |
| Atlas client + API contracts | Typed client and local file-backed HTTP service implement publication/read/search/contract behavior covered by conformance, HTTP, persistence, and V2 tests | Atlas client/API + service contracts | local software | **software-qualified** | No production authz, rate limiting, multi-tenant hosting, public-network security qualification, or operational SLA |
| Research corpus governance | Benchmark snapshots, readiness checks, group semantics, and material-truth assertions exist as software contracts | research-corpus contracts | software | **software-qualified** | Does not create a physical benchmark corpus or certify labels that were never collected |
| Similarity promotion governance | Candidate similarity algorithms can be compared against a deterministic baseline under held-out policy without silently accepting regressions | similarity promotion policy | software / digital tests | **software-qualified** | Policy execution is not physical identity validation and cannot promote a model beyond its evidence population |
| Empirical v8 campaign | Gate A2/B/C remain bound to the frozen physical/perceptual contracts | `gate-a-2`, `gate-b-1`, `gate-c-1`, `validation-evidence-5` | intended physical campaign | **prototype** | Not yet run; software qualification cannot advance this row |

## Promotion rule

A capability advances only when evidence for the exact proposition, exact version, named population, exclusions, and trust boundary exists. High-stakes product-facing scientific claims require independent review before `product-eligible` or `released` status.

Twin, material, station, and Atlas UI copy must never present a `software-qualified` or `synthetic-qualified` result as a released physical-world conclusion. Failed, abstained, missing, or unfavorable observations remain part of the evidence record when the governing protocol requires them.

Update this registry when evidence is attached—not because a workflow went green on a different proposition.
