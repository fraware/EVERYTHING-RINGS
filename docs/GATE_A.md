# Gate A2 — physical acoustic validity

Gate A2 is the first physical release gate. It must pass before the measured modal representation is treated as physically validated. The digital-twin lane is supporting stress validation only and is never release-gate equivalent.

## Protocol

Assign every physical test specimen a stable `specimenId` before capture. The ID identifies the physical specimen across sessions; the human-readable object label is presentation metadata and does not create a new specimen. Re-recording the same physical object under another label must reuse the same `specimenId`.

For each session, collect **exactly five acquisition-quality-passing attempts** using the same device and approximately fixed microphone distance, striker, strike position, and support condition. The specimen identity and setup are locked for the session.

Acquisition-quality failures do not enter the five-attempt experiment and may be retried. Once an attempt satisfies the frozen acquisition-quality bounds, it is irrevocably assigned the next attempt ID. Its analytical outcome is retained whether modal analysis succeeds or fails. A qualified analytical failure cannot be discarded, renumbered, or replaced by another strike. The fifth qualified attempt closes the physical session for release purposes.

This rule eliminates retry-until-success and optional-stopping paths. The experiment is defined by the first five qualified physical attempts, not by the first five successful analyses.

## Frozen campaign cohort

The canonical first empirical campaign contains exactly twelve precommitted slots. The six release-core slots are:

- `core-metal-1` and `core-metal-2`, from two distinct metal object families;
- `core-glass-1` and `core-glass-2`, from two distinct glass object families;
- `core-ceramic-1` and `core-ceramic-2`, from two distinct ceramic object families.

The six challenge slots are:

- `challenge-short-decay` — strong damping / short audible decay;
- `challenge-broad` — weak or broad resonant structure;
- `challenge-coupled` — heterogeneous or coupled multi-part structure;
- `challenge-high-q` — low damping / long ringdown, intentionally distinct from modal degeneracy;
- `challenge-low-snr` — weakly radiating or near the acquisition SNR floor;
- `challenge-degenerate` — symmetry, near-symmetry, close modes, or strike-location sensitivity.

Specimen selection is made from a finite non-acoustic candidate register before production audition. The register records physical identity, family, material, safety/support facts, markable strike location, eligible slots, and exclusions; it must not contain fingerprints, frequencies, decay estimates, mode counts, acoustic scores, or audition rankings. A selected specimen binds slot and inventory identity in its `specimenId`, for example `core-metal-1--inv-003`.

The campaign manifest is frozen before the first production strike. Its exact bytes and campaign signature are retained. Collection order is then derived deterministically from `SHA-256("gate-a2-order-v1|<campaign-signature>|<specimenId>")`, sorting release-core and challenge cohorts separately and interleaving them beginning with release-core. The order is recorded before collection.

For every qualified attempt record the native sample rate, actual microphone-processing settings, capture-quality diagnostics, and one terminal analytical outcome:

- `success`, with the complete versioned `er-dsp-2` fingerprint; or
- `failure`, with `SIGNAL_TOO_SHORT`, `NO_STABLE_RESONANCES`, or `ANALYSIS_INTERNAL_ERROR`.

Raw microphone PCM remains local.

## Frozen release contract — `gate-a-2`

These thresholds are fixed before the campaign dataset is accepted and must not be relaxed after observing measurements.

A specimen session passes only when all of the following hold:

- a non-empty stable `specimenId` is present;
- exactly five qualified attempts are present, with sequential attempt IDs `1..5`;
- every retained attempt satisfies the acquisition bounds used by the capture path: peak amplitude ≥ 0.02, SNR ≥ 12 dB, clipped fraction ≤ 0.001, and secondary-impact ratio ≤ 0.65;
- all five qualified attempts produce valid `er-dsp-2` fingerprints containing at least three accepted modes;
- no qualified analytical failure is present;
- recurrence is recomputed from the successful fingerprints using the shared one-to-one matcher, with **attempt 1 fixed as the reference** and attempts 2–5 as the four candidates;
- every recomputed comparison matches at least three strong reference modes;
- the median of the four recomputed comparison medians is at most 25 cents;
- no individual recomputed comparison median exceeds 50 cents;
- the setup metadata is complete and declares a fixed-setup session;
- the evidence bundle contains no raw microphone samples.

Attempt 1 is never substituted. If attempt 1 fails analysis, the session cannot satisfy Gate A2. If any later qualified attempt fails analysis, the session also cannot satisfy Gate A2. A sixth attempt cannot repair either case.

The exported recurrence rows and aggregate drift are caches for audit and display. The parser requires them to agree with recomputation from the retained qualified-attempt fingerprints, and the release evaluator uses the recomputed values as its source of truth.

Gate A2 passes at release level when all imported sessions come from one software revision and one fingerprint algorithm version, at least **five distinct normalized `specimenId` values** have passing sessions, and the passing specimen set contains metal, glass, and ceramic. The empirical campaign adds a stronger accounting requirement: all twelve precommitted specimen outcomes must be present or explicitly accounted before canonical adjudication. Multiple passing sessions for one physical specimen still count as one specimen. Changing only an object label cannot increase release distinctness. Duplicate session IDs invalidate the release verdict. Reusing one normalized `specimenId` with conflicting material classes also invalidates the release-level verdict, including when the conflicting session itself fails physically.

The drift bounds are release criteria for repeatable structure under the frozen setup. They are not a nuisance-invariance result, a general perceptual similarity metric, an object-identity probability, or a material-identification claim.

## Session-fatal errors

A recoverable analytical result such as `NO_STABLE_RESONANCES` is retained as the qualified attempt's terminal outcome and the experiment may proceed to the next slot if fewer than five attempts have been consumed.

A true session-level internal error is different. The validation lab does not permit another qualified attempt on potentially compromised worker/audio resources. Retained evidence should be exported, the session stopped, and any further experiment started under a **new session ID**. If the same physical specimen is tested again, it must retain the same `specimenId`. The interrupted session does not become passable by continuing after the fatal error.

## Evidence and algorithm versioning

Gate A2 uses `validation-evidence-5` with `schemaVersion: 5` and `gateAContractVersion: "gate-a-2"`. Schema v5 requires the exact software commit, and release-level evidence must use one revision and one fingerprint algorithm version. `er-dsp-2` is the canonical estimator for this physical collection cycle; it includes the frozen -60 dB relative-amplitude measurement-support floor. Historical `er-dsp-1` bundles remain readable for audit but must not be mixed with `er-dsp-2` evidence in one session or release evaluation.

Schema v4 was superseded before physical release collection because it lacked implementation provenance; the older record-only Gate A1 format is also superseded because it could not represent qualified analytical failures without selection bias.

## External and digital-twin evidence

External cross-field recurrence and deterministic digital twins are supporting evidence only. Neither satisfies Gate A2 because neither proves the exact physical microphone/transducer/object path under the frozen campaign. They may be used to find software defects, exercise nuisance regimes, and compare future estimators, but must never be imported into the canonical Release Console as physical campaign evidence or used to tune `gate-a-2` after observing campaign data.

## Failure handling

A failure is evidence. Acquisition-quality failure permits another acquisition because it never entered the qualified set. After acquisition quality passes, the attempt is final. Analytical failure remains in the evidence bundle and closes one of the five slots. Investigate the mechanism; do not lower the frozen contract, relabel the specimen, or replace the attempt solely to obtain a pass.
