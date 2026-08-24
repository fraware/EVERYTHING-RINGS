# Digital-twin qualification lane

Digital twins are the executable substitute for unavailable physical-object work during the current software-hardening stage. They are deliberately **not** physical Gate A2 evidence.

## Claim boundary

Every digital-twin result carries the semantic flag:

`releaseGateEquivalent: false`

A digital twin may demonstrate that acquisition-quality logic, deterministic DSP, recurrence, synthesis, playable transposition, evidence/planning code, provenance, or browser/review workflows behave as designed under controlled signals. It cannot demonstrate:

- a real microphone transducer path;
- a real physical impact interaction;
- room/support/striker nuisance behavior not encoded in the model;
- perceptual Gate B judgments by human reviewers;
- device-listening Gate C judgments;
- physical-object identity or material inference.

Digital artifacts must never be imported into the canonical physical Release Console as `validation-evidence-5` campaign sessions.

## Digital specimen model

The baseline digital specimen is a deterministic sum of damped sinusoidal modes:

`x(t) = Σ a_i exp(-t/τ_i) sin(2π f_i t + φ_i) + n(t)`

where modal frequency, damping, excitation amplitude, phase, and deterministic noise are explicit. Test variants may change gain, modal excitation tilt, damping scale, mode spacing, modal density, and noise level. Each variant is a new modeled interaction with known ground truth.

This is intentionally a simplified acoustic object model. It is useful because the expected mechanism is known exactly; it is not treated as a complete simulation of a physical object.

## Required digital stress classes

The software qualification suite should cover:

1. ordinary multi-mode resonant objects;
2. short-decay / heavily damped responses;
3. broad or weak modal structure;
4. coupled or multi-cluster modal structure;
5. long-decay / high-Q responses;
6. low-SNR responses;
7. close-mode / near-degenerate responses;
8. gain changes;
9. modal-excitation changes approximating strike-location sensitivity;
10. damping variation;
11. hard-negative digital specimens with different modal geometry;
12. explicit analysis failures that remain failures rather than being retried until success.

## Qualification layers

### Acquisition and quality

Construct captures with a pre-trigger noise segment and known trigger. Exercise SNR, clipping, amplitude, and secondary-transient boundaries. Verify deterministic accept/reject behavior and failure reasons.

### DSP and recurrence

Analyze deterministic ringdowns with canonical `analyzeImpact()`. Verify only `er-dsp-2` output is evidence-versioned. Under moderate nuisance variation, evaluate mode recurrence and record matched count and modal drift. Under close-mode or weak-mode stress, failures remain informative and must not be converted to a pass by changing frozen parameters.

### Reconstruction

Render the fingerprint through the canonical modal renderer. Check finite output, peak bounds, deterministic rendering, and reanalysis behavior. This is an objective software test; it is not a replacement for blinded Gate B perceptual review.

### Playable instrument

Render notes across low, central, and high transpositions. Verify finite output, one global modal frequency ratio, Nyquist filtering, and deterministic note parameters. This is not a replacement for Gate C device listening or end-to-end acoustic latency measurement.

### Canonical review governance

Use synthetic evidence objects only in unit tests to prove that Gate B cannot pass without the exact five-target/two-reviewer ten-judgment matrix and Gate C cannot pass without the exact four-target/two-reviewer/two-device sixteen-judgment matrix. Synthetic reviews test evaluator semantics; they are not human evidence.

### Provenance and Atlas

On the post-freeze research branch, digital measurements may exercise content-addressed MeasurementRecord/DerivationRecord and Atlas schemas. They must be labeled as synthetic/non-physical artifacts and must not be promoted to calibrated Sonic Twin evidence.

## Exit criterion

The digital lane is complete for a revision when typecheck, unit tests, deterministic digital stress tests, build, and browser E2E all pass on the exact revision, and the qualification report explicitly states `releaseGateEquivalent: false`.

Physical issue #64 remains open after a digital qualification pass. When physical work becomes possible, the actual microphone/transducer preflight is still required before any physical campaign evidence can be accepted.
