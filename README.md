# EVERYTHING RINGS

**Hit anything. Discover how it rings.**

EVERYTHING RINGS is a local-first acoustic instrument for estimating the audible resonances of struck physical objects, reconstructing those resonances, and turning them into playable instruments.

## Current phase

MVP-0 starts with acoustic validity. The repository currently implements the numerical foundation: deterministic synthetic fixtures, an isolated FFT backend, Hann-windowed magnitude spectra, and sub-bin peak estimation. Browser acquisition, visualization, social features, and the Resonance Atlas intentionally come later.

## Engineering invariants

- Scientific claims stop at estimated audible resonances from the recorded transient.
- DSP is deterministic and independent of React, the DOM, and Web Audio.
- Native capture sample rates are propagated explicitly; no algorithm assumes 48 kHz.
- Physical quantities include units in identifiers.
- No learned model enters the pipeline until the deterministic baseline is characterized.

## Development

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

See `docs/SPEC.md`, `docs/DSP.md`, and `docs/VALIDATION.md` for the implementation contract and release gates.
