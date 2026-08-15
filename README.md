# EVERYTHING RINGS

**Hit anything. Discover how it rings.**

EVERYTHING RINGS is a local-first acoustic instrument for estimating the audible resonances of struck physical objects, reconstructing those resonances, and turning them into playable instruments.

## Current phase

MVP-0 now contains the full software path from microphone capture to reveal and play: deterministic impact analysis, capture-quality gates, ringdown isolation, versioned acoustic fingerprints, one-to-one recurrence comparison, modal reconstruction, realtime playable modal synthesis, Acoustic DNA, a validation lab, and the consumer **STRIKE → REVEAL → HEAR → PLAY** loop.

The remaining release gates are empirical. External real-object recurrence is measured with the RealImpact validation harness, and reconstruction/playable quality still require physical and perceptual validation across representative objects and devices. The repository does not treat those gates as passed from synthetic or cross-field tests alone.

## Engineering invariants

- Scientific claims stop at estimated audible resonances from the recorded transient.
- DSP is deterministic and independent of React, the DOM, and Web Audio.
- Native capture sample rates are propagated explicitly; no algorithm assumes 48 kHz.
- Physical quantities include units in identifiers.
- Microphone PCM remains local in MVP-0.
- Reconstruction synthesizes estimated modes; recorded audio is not mixed into the model output.
- Realtime notes preserve one global modal frequency ratio and the measured decay constants.
- Acoustic DNA is a deterministic encoding of the measured fingerprint.
- No learned model enters the pipeline until the deterministic baseline is characterized.

## Development

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

The root web experience is the consumer loop. Append `?lab=1` to open the measurement and validation surface.

See `docs/SPEC.md`, `docs/DSP.md`, `docs/VALIDATION.md`, `docs/GATE_A.md`, `docs/REALIMPACT.md`, `docs/GATE_B.md`, `docs/GATE_C.md`, `docs/ACOUSTIC_DNA.md`, and `docs/DEPLOYMENT.md` for the implementation contracts, release gates, and deployment path.
