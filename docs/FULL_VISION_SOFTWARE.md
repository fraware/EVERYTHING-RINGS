# Full-Vision Software Architecture

This document defines the software-qualified architecture for the long-term EVERYTHING RINGS system. It does not redefine the empirical release contracts on `main`, and it does not treat digital twins as physical evidence.

## System model

The mature data model is deliberately observation-centric:

`specimen -> interaction -> capture -> immutable measurement -> derivation -> acoustic object model -> retrieval / spatial model -> Atlas publication`

A capture is one observation. A fingerprint is one deterministic analysis of one observation. Neither is a canonical physical-object identifier.

## Measurement and derivation boundary

`MeasurementRecordV1` content-addresses acquisition contract, exact software revision, specimen/session/attempt identity, station metadata, setup metadata, fingerprint algorithm, and fingerprint. Raw microphone samples are excluded.

Renderer, instrument, similarity, embedding, visualization, and Atlas products are separate `DerivationRecordV1` artifacts rooted in the immutable measurement. Updating a downstream model does not rewrite measurement identity.

The research repository verifies every measurement, derivation, Atlas record, and specimen-merge content address before treating the repository as integrity-valid.

## Sonic Twin

The deterministic reference path provides:

- repeated-observation `AcousticObjectModelV1` estimates;
- nuisance characterization for strike, support, room, station, operator, and day;
- specimen-disjoint benchmark splitting and hard-negative construction;
- match / nonmatch / abstain verification;
- specimen-level ranked retrieval with Recall@K and MRR;
- group-disjoint calibration fitting and held-out calibration evaluation;
- Brier score, calibration error, ROC AUC, and risk-coverage reporting;
- promotion policy that requires held-out improvement without prohibited regressions.

Calibrated probabilities are scoped to their named calibration population. They are not universal physical-object probabilities.

## Spatial acoustic model

`SpatialModalSoundFieldV1` separates relatively stable modal frequency/decay estimates from strike-location-dependent excitation amplitudes. `fingerprintAtSpatialPoint()` returns a `SpatialPredictedFingerprintV1` that is explicitly `evidenceEligible: false` and carries source algorithm provenance instead of stamping a canonical measurement algorithm version.

## Research-only estimators and inference

The high-resolution damped-mode estimator and material-inference baseline are research paths. They are not release fingerprint algorithms and do not change the current scientific claim. Promotion requires separate held-out evidence and an explicit version transition.

## Station qualification

Station calibration protocols are content-addressed against a frozen reference object model. Authoritative evaluation first verifies the protocol digest, then evaluates mode coverage, matched-mode support, and modal drift.

## Resonance Atlas

Atlas publication is privacy-preserving and content-addressed. The software model includes:

- immutable Atlas records and snapshots;
- append-only record publication;
- measurement-to-specimen ownership checks;
- explicit, evidence-backed and content-verified specimen merges;
- content-verified collections;
- search and deterministic service conformance;
- contributor, specimen, record, and collection graph projection;
- explicit edges only; no inferred same-object edge is created by graph projection.

A future network/database adapter must satisfy the same service and artifact contracts rather than redefining them.

## Assurance boundary

Software qualification may support propositions about deterministic execution, artifact integrity, synthetic acoustic recovery, retrieval on named digital populations, browser flows, and local service semantics.

Software qualification does not by itself support propositions about physical-object identity, material identity in the world, human perceptual fidelity, microphone-transducer behavior, or real playback-chain behavior.

Machine-readable capability claims bind one proposition to its scope, exclusions, evidence references, and maturity. Software qualification manifests are content-addressed, require at least one explicit capability claim, and retain the non-empirical boundary flags.

## Software qualification

The full-vision workflow uses frozen dependency installation, repository-wide typechecking, all unit and digital-twin tests, complete builds, browser/lifecycle qualification, and a machine-readable qualification artifact. Workflow actions are pinned to immutable revisions and concurrent superseded runs are cancelled for the same branch or pull request.

A full-vision software baseline is promotable only when one exact revision passes the complete qualification workflow. The subsequently merged product/research revision must itself be qualified before a named software freeze is created.
