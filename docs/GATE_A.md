# Gate A2 — physical acoustic validity

Gate A2 is the first physical release gate. It must pass before the measured modal representation is treated as physically validated.

## Protocol

For each object, collect **exactly five acquisition-quality-passing attempts** using the same device and approximately fixed microphone distance, striker, strike position, and support condition. The setup is locked for the session.

Acquisition-quality failures do not enter the five-attempt experiment and may be retried. Once an attempt satisfies the frozen acquisition-quality bounds, it is irrevocably assigned the next attempt ID. Its analytical outcome is retained whether modal analysis succeeds or fails. A qualified analytical failure cannot be discarded, renumbered, or replaced by another strike. The fifth qualified attempt closes the physical session for release purposes.

This rule eliminates retry-until-success and optional-stopping paths. The experiment is defined by the first five qualified physical attempts, not by the first five successful analyses.

The initial release set is: bell, wine glass, metal bowl, glass bottle, ceramic mug. Equivalent strongly resonant objects are acceptable if the final set still contains distinct metal, glass, and ceramic examples.

For every qualified attempt record the native sample rate, actual microphone-processing settings, capture-quality diagnostics, and one terminal analytical outcome:

- `success`, with the complete versioned `er-dsp-1` fingerprint; or
- `failure`, with `SIGNAL_TOO_SHORT`, `NO_STABLE_RESONANCES`, or `ANALYSIS_INTERNAL_ERROR`.

Raw microphone PCM remains local.

## Frozen release contract — `gate-a-2`

These thresholds are fixed before the local five-object Gate A2 dataset is collected and must not be relaxed after observing measurements.

An object session passes only when all of the following hold:

- exactly five qualified attempts are present, with sequential attempt IDs `1..5`;
- every retained attempt satisfies the acquisition bounds used by the capture path: peak amplitude ≥ 0.02, SNR ≥ 12 dB, clipped fraction ≤ 0.001, and secondary-impact ratio ≤ 0.65;
- all five qualified attempts produce valid `er-dsp-1` fingerprints containing at least three accepted modes;
- no qualified analytical failure is present;
- recurrence is recomputed from the successful fingerprints using the shared one-to-one matcher, with **attempt 1 fixed as the reference** and attempts 2–5 as the four candidates;
- every recomputed comparison matches at least three strong reference modes;
- the median of the four recomputed comparison medians is at most 25 cents;
- no individual recomputed comparison median exceeds 50 cents;
- the setup metadata is complete and declares a fixed-setup session;
- the evidence bundle contains no raw microphone samples.

Attempt 1 is never substituted. If attempt 1 fails analysis, the session cannot satisfy Gate A2. If any later qualified attempt fails analysis, the session also cannot satisfy Gate A2. A sixth attempt cannot repair either case.

The exported recurrence rows and aggregate drift are caches for audit and display. The parser requires them to agree with recomputation from the retained qualified-attempt fingerprints, and the release evaluator uses the recomputed values as its source of truth.

Gate A2 passes at release level when at least five distinct object labels have passing sessions and the passing set contains metal, glass, and ceramic objects. Duplicate session IDs invalidate the release verdict. Reusing one normalized object label with conflicting material classes also invalidates the release-level verdict, including when the conflicting session itself fails physically.

The drift bounds are release criteria for repeatable structure. They are not a general perceptual similarity metric.

## Evidence versioning

Gate A2 uses `validation-evidence-4` with `schemaVersion: 4` and `gateAContractVersion: "gate-a-2"`. The previous record-only Gate A1 format is superseded for release evaluation because it could not represent qualified analytical failures without selection bias.

## External evidence

External cross-field recurrence is supporting evidence only. It does not satisfy Gate A2 because listener position and other acquisition conditions vary across those measurements. External results must never be used to tune `gate-a-2` after the fact.

## Failure handling

A failure is evidence. Acquisition-quality failure permits another acquisition attempt because it never entered the qualified set. After acquisition quality passes, the attempt is final. Analytical failure remains in the evidence bundle and closes one of the five slots. Investigate the mechanism; do not lower the frozen contract or replace the attempt solely to obtain a pass.
