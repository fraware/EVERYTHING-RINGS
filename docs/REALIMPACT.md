# RealImpact external validation

EVERYTHING RINGS uses RealImpact as an external physical benchmark for Gate A. RealImpact contains controlled impact recordings of 50 everyday objects and records at 48 kHz. Its acquisition system repeatedly strikes selected object vertices with an instrumented impact hammer while recording the resulting sound field.

The dataset is not vendored or redistributed by this repository. Obtain it from the RealImpact authors' published download path and review their applicable data terms.

## One-object benchmark

The upstream dataset repository lists object archive names in `dataset/object_names.txt` and downloads them from the Stanford RealImpact host. A useful first object is `64_CeramicMug`.

After extracting an object archive, run:

```bash
REALIMPACT_DIR=/absolute/path/to/64_CeramicMug \
REALIMPACT_REPORT=/tmp/everything-rings-realimpact.json \
pnpm --filter @everything-rings/dsp test:realimpact
```

Optional controls:

- `REALIMPACT_VERTEX_ID` chooses a specific impacted mesh vertex.
- `REALIMPACT_MIC_INDEX` chooses a microphone position on the 15-microphone vertical bar; default `7`.
- `REALIMPACT_MAX_STRIKES` bounds the number of separate strikes analyzed; default `12`.

The harness reads `sounds.npy` row-by-row instead of loading the full sound matrix. It groups a common impacted vertex and consistent microphone-bar index across separate gantry positions, runs the exact `er-dsp-1` estimator, and reports analysis acceptance plus nearest-mode frequency drift in cents relative to the first accepted strike.

This report is diagnostic until empirical distributions establish a defensible pass threshold. Do not choose a threshold after looking at a single favorable object.
