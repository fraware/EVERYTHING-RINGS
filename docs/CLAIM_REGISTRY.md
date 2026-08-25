# Capability claim registry

Human-readable index of EVERYTHING RINGS capabilities and the maturity ladder that binds them. Machine-readable claim objects (`CapabilityClaimV1`, `SoftwareQualificationManifestV1`) live in `packages/validation` and are owned by the validation/assurance lane. This document does not change those contracts.

Software qualification never implies physical evidence. A green CI run, an SBOM, or a digital-twin report is not Gate A2/B/C, microphone validation, object identity, or material identity.

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

`CapabilityClaimV1` currently enumerates `implemented` | `software-qualified` | `empirically-qualified`. Map as follows until the validation lane extends the enum:

- `prototype` ↔ `implemented`
- `software-qualified` and `synthetic-qualified` ↔ `software-qualified` (synthetic-qualified additionally requires digital-twin evidence)
- `physical-research` through `released` ↔ `empirically-qualified` only when empirical-domain evidence is attached; do not stamp `empirically-qualified` for software-only work

## Claim fields (every row)

Each capability binds:

- exact proposition;
- algorithm / contract version;
- population (or "none — software only");
- exclusions (what it does **not** establish);
- source artifacts / evidence domain;
- metrics if any;
- trust boundary;
- review state;
- current ladder rung.

## Registry

Rungs below are the highest currently earned. They are not aspirations.

| Capability | Proposition | Version | Population | Current rung | Exclusions |
|------------|-------------|---------|------------|--------------|------------|
| Resonance estimation | Estimated audible resonances supported by each recorded transient under `er-dsp-2` | `er-dsp-2` | software path; physical campaign not yet closed | software-qualified | Not eigenmodes, not object identity, not a universal signature, not proof nearby peaks are the same physical mode |
| Reconstruction | Modal reconstruction synthesizes estimated modes from a fingerprint; recorded PCM is not mixed into the model | modal renderer on frozen fingerprint | software | software-qualified | Not calibrated loudness; not a physical playback-chain claim |
| Playable identity | Chromatic playable instrument from a fingerprint-derived model | modal instrument | software / consumer path | software-qualified | Not authenticity; not a canonical object ID |
| Station qualification | Station protocol and diagnostic/verified evaluators exist as software contracts | `packages/validation` station-calibration | digital-station tests only | software-qualified | Does not establish that a physical booth reproduces a reference object |
| Twin retrieval | Deterministic retrieval ranks the correct digital specimen in the named software corpus | sonic-twin index / baseline | built-in digital qualification corpus | synthetic-qualified | Not physical-object identity; not a consumer "same object" score |
| Twin verification | match / nonmatch / abstain baseline and calibration contracts exist | `sonic-twin-isotonic-calibration-2` | digital held-out groups in software tests | synthetic-qualified | Calibrated probability is not a universal same-object probability |
| Spatial prediction | `fingerprintAtSpatialPoint` returns a predicted fingerprint | spatial field V1 | software | software-qualified | Predicted fingerprints are `evidenceEligible: false` and are never measurements |
| Material inference | Centroid baseline exists as research | `material-centroid-research-1` | software research tests | prototype | `evidenceEligible: false`; `calibratedProbability: null`; not a consumer material label |
| Atlas integrity | Content-addressed Atlas records, snapshots, collections, and merges detect mutation in software tests | Atlas V1 contracts | software | software-qualified | Not a production network; not physical provenance truth |
| Atlas network conformance | `MemoryResonanceAtlasServiceV1` passes the in-memory conformance harness | `resonance-atlas-service-1` | software | software-qualified | Production adapter, durability, authz, and rate limits are not claimed; see workflow skeleton |
| Measurement provenance | `MeasurementRecordV1` / `DerivationRecordV1` content-address one measurement and single-source derivations | provenance V1 | software | software-qualified | V1 has a single `measurementId`; V2 multi-source graphs are not claimed |
| Artifact integrity | Artifact envelopes detect payload tampering; SHA-256 of source files is exact bytes | envelope V1; `er-cli` hash | software | software-qualified | Hashing is not a freeze; CLI is not the v8 evidence-production path |
| Browser consumer loop | STRIKE → REVEAL → HEAR → PLAY on synthetic/browser-injected audio in CI | consumer web | CI browser smoke | software-qualified | Not a physical microphone path; not Gate A2 |
| Empirical v8 campaign | Gate A2/B/C under frozen contracts | `gate-a-2`, `gate-b-1`, `gate-c-1`, `validation-evidence-5` | intended physical campaign | prototype | Not run; software must not change thresholds. E1 exits on recorded PASS or fail |

## Promotion rule

Independent review is required before a high-stakes scientific claim becomes product-facing (reviewer ≠ implementer). Twin/Atlas UI copy and feature flags must not present a `software-qualified` or `synthetic-qualified` demo as `released` physical identity.

Update this registry when evidence is attached, never because a workflow went green on synthetic inputs.
