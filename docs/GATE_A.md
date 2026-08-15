# Gate A — physical acoustic validity

Gate A is the first physical release gate. It must pass before modal reconstruction or consumer visualization is treated as validated.

## Protocol

For each object, record five accepted strikes using the same device, approximate microphone distance, striker, strike position, and support condition.

Start with: bell, wine glass, metal bowl, glass bottle, ceramic mug.

For every strike record the native sample rate, actual microphone-processing settings, SNR, clipping fraction, secondary-impact ratio, accepted acoustic modes, and mode confidences.

## Pass criteria

For at least five strongly resonant objects:

- acquisition quality passes without manual editing;
- at least three stable modes survive analysis on most strikes;
- the strongest recovered frequencies recur across repeated strikes;
- mode-solo interpretation can later be tied to components audible in the source recording;
- results are not dominated by obvious false tracks.

The analysis lab reports one-to-one fingerprint recurrence relative to the first accepted strike, including median modal drift in cents and unmatched reference modes. This is a diagnostic, not yet a universal similarity score.

External cross-field recurrence is supporting evidence only. It does not satisfy this gate because microphone position and other acquisition conditions vary across those measurements.

## Failure handling

A failure is informative. Distinguish acquisition failure (clipping, low level, low SNR, multiple impacts) from analytical failure (`NO_STABLE_RESONANCES`). Do not lower thresholds solely to force a result.
