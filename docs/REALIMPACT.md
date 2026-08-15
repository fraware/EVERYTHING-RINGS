# RealImpact external validation

EVERYTHING RINGS uses RealImpact as external physical evidence for the modal estimator. RealImpact contains controlled impact measurements of everyday objects at 48 kHz. The released object archives include deconvolved acoustic responses together with impacted-vertex and microphone identifiers.

The dataset is not vendored or redistributed by this repository. Obtain it from the RealImpact authors' published download path and review their applicable data terms.

## What this benchmark establishes

The RealImpact acquisition repeats an impact at the same object vertex as a 15-microphone gantry moves through multiple listener positions. Selecting one microphone index across successive gantry positions therefore tests whether the estimator recovers the same structural modal frequencies across separate impacts and changing listener locations.

That is useful **cross-field modal-recurrence evidence**. It is not equivalent to the local Gate A release protocol, which requires five accepted strikes per object with the device, microphone distance, striker, strike position, and support condition held approximately fixed across at least five strongly resonant objects.

## One-object benchmark

A useful first object is `64_CeramicMug`.

After extracting an object archive, run:

```bash
REALIMPACT_DIR=/absolute/path/to/64_CeramicMug \
REALIMPACT_REPORT=/tmp/everything-rings-realimpact.json \
pnpm --filter @everything-rings/fingerprint test:realimpact
```

Optional controls:

- `REALIMPACT_VERTEX_ID` chooses a specific impacted mesh vertex.
- `REALIMPACT_MIC_ID` chooses a microphone on the 15-microphone vertical bar; default `7`.
- `REALIMPACT_MAX_MEASUREMENTS` bounds the number of separate measurements analyzed; default `8`.

The harness reads `preprocessed/deconvolved_0db.npy` row-by-row instead of loading the full matrix. It groups a repeated impacted vertex and microphone ID, isolates each ringdown, runs the exact `er-dsp-1` estimator, and compares accepted fingerprints with the shared one-to-one recurrence metric. Missing modal structure therefore incurs an explicit penalty instead of allowing one candidate resonance to explain multiple reference resonances.

The report explicitly declares `validationScope: cross-field-modal-recurrence` and `releaseGateEquivalent: false`. It records estimator acceptance, per-measurement recurrence, matched and unmatched mode counts, and aggregate cross-field modal drift in cents. These values remain descriptive external evidence; they do not set the local Gate A threshold after the result is known.
