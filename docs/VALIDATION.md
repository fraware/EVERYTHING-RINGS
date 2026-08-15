# Validation

Validation is a release requirement, not a demo aid.

## Numerical foundation

The deterministic numerical suite checks known modal signals at both 44.1 kHz and 48 kHz. A 997 Hz sinusoid analyzed through the 8192-sample Hann-windowed transform must recover frequency within 1 Hz after quadratic interpolation.

The end-to-end golden modal fixture contains 440 Hz / 1.2 s, 997 Hz / 0.7 s, and 2413 Hz / 0.38 s decays. `analyzeImpact()` must recover all three at both standard sample rates, with frequency error below max(3 Hz, 0.5%) and decay error below 15%. Silence and dead/noise fixtures must fail closed instead of manufacturing stable modes. Clipping, secondary impacts, dense neighboring modes, and sample-rate invariance are covered by deterministic regression cases.

These tests establish algorithmic behavior. They do not establish physical validity on real objects.

## Physical validation — Gate A2

Physical validation starts with strongly resonant positive controls: bell, wine glass, metal bowl, glass bottle, and ceramic mug. Each physical specimen receives a stable `specimenId` that is reused across sessions; display labels do not define release distinctness.

A Gate A2 session is the first five acquisition-quality-passing attempts under one locked setup. Once an attempt qualifies, its analysis outcome is retained permanently. Attempt 1 remains the recurrence reference. Analytical failures cannot be retried away, and a sixth success cannot repair a failed slot.

A true internal session error terminates that session. Further capture requires a new session ID, retaining the same specimen ID when the same physical object is tested again.

Gate A2 release status requires at least five distinct passing physical specimens with metal, glass, and ceramic coverage. Synthetic fixtures and external/cross-field recordings are supporting evidence only.

## Perceptual validation — Gate B

Gate B evaluates whether modal reconstruction preserves the identity of Gate A2-passing specimens. Reviews are blinded and bound to one exact passing `(sessionId, attemptId)` target. Multiple sessions of one specimen are never pooled into one listening judgment; all counted reviewers for that specimen must assess the same selected target.

## Playability validation — Gate C

Gate C inherits the exact target selected by Gate B and evaluates whether the specimen remains identifiable as a chromatically transposed modal instrument. Passing evidence requires cross-device listening; device diversity is counted only from Gate C-passing specimens, with at least one mobile device.

## Release rule

The release console evaluates the frozen Gate A2/B/C contracts from local schema-v4 evidence. Missing, malformed, contradictory, or provenance-inconsistent evidence remains OPEN. The release is empirically ready only when all three gates pass without changing thresholds, specimen identity, targets, or failed attempts to fit the observed data.
