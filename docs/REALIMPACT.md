# RealImpact external validation

EVERYTHING RINGS uses RealImpact as an external physical benchmark for Gate A. RealImpact contains controlled impact measurements of everyday objects at 48 kHz. The released object archives include deconvolved acoustic responses together with impacted-vertex and microphone identifiers.

The dataset is not vendored or redistributed by this repository. Obtain it from the RealImpact authors' published download path and review their applicable data terms.

## One-object benchmark

The upstream dataset repository lists object archive names in `dataset/object_names.txt`. A useful first object is `64_CeramicMug`.

After extracting an object archive, run:

```bash
REALIMPACT_DIR=/absolute/path/to/64_CeramicMug \
REALIMPACT_REPORT=/tmp/everything-rings-realimpact.json \
pnpm --filter @everything-rings/fingerprint test:realimpact
```

Optional controls:

- `REALIMPACT_VERTEX_ID` chooses a specific impacted mesh vertex.
- `REALIMPACT_MIC_ID` chooses a microphone on the 15-microphone vertical bar; default `7`.
- `REALIMPACT_MAX_STRIKES` bounds the number of separate measurements analyzed; default `8`.

The harness reads `preprocessed/deconvolved_0db.npy` row-by-row instead of loading the full matrix. It groups a repeated impacted vertex and microphone ID, isolates the ringdown, runs the exact `er-dsp-1` estimator, and compares accepted fingerprints with the shared one-to-one recurrence metric. Missing modal structure therefore incurs an explicit penalty instead of allowing a single candidate resonance to explain multiple reference resonances.

The report records estimator acceptance, per-measurement recurrence, matched and unmatched mode counts, and aggregate modal drift in cents. These values remain diagnostic until measurements across multiple objects and material classes establish a defensible pass threshold. Do not choose a threshold from a single favorable object.
