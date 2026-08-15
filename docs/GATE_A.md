# Gate A — physical acoustic validity

Gate A is the first physical release gate. It must pass before the measured modal representation is treated as physically validated.

## Protocol

For each object, record five accepted strikes using the same device and approximately fixed microphone distance, striker, strike position, and support condition. Record those setup fields in the evidence bundle.

The initial release set is: bell, wine glass, metal bowl, glass bottle, ceramic mug. Equivalent strongly resonant objects are acceptable if the final set still contains distinct metal, glass, and ceramic examples.

For every strike record the native sample rate, actual microphone-processing settings, capture-quality diagnostics, accepted acoustic modes, and mode confidences. Raw microphone PCM remains local.

## Frozen release contract — `gate-a-1`

These thresholds were fixed before the local five-object release dataset was collected. They are independent of the RealImpact result and must not be relaxed after observing local measurements.

An object session passes when all of the following hold:

- five accepted strikes are present;
- at least four of the five strikes contain at least three stable modes;
- the first accepted strike yields four recurrence comparisons against the remaining strikes;
- every comparison matches at least three strong reference modes using the shared one-to-one recurrence matcher;
- the median of the four comparison medians is at most 25 cents;
- no individual comparison median exceeds 50 cents;
- the setup metadata is complete and declares a fixed-setup session;
- the evidence bundle contains no raw microphone samples.

Gate A passes when at least five distinct object sessions pass and the passing set contains metal, glass, and ceramic objects.

The drift bounds are release criteria for repeatable structure. They are not a general perceptual similarity metric.

## External evidence

External cross-field recurrence is supporting evidence only. It does not satisfy Gate A because listener position and other acquisition conditions vary across those measurements. External results must never be used to tune `gate-a-1` after the fact.

## Failure handling

A failure is informative. Distinguish acquisition failure from analytical recurrence failure. Keep failed evidence and investigate the mechanism; do not lower the frozen contract solely to obtain a pass.
