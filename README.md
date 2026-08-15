# EVERYTHING RINGS

**Hit anything. Discover how it rings.**

EVERYTHING RINGS is a local-first acoustic instrument for estimating the audible resonances of struck physical objects, reconstructing those resonances, and turning them into playable instruments.

## Current phase

MVP-0 contains the full software path from microphone capture to reveal and play: deterministic impact analysis, capture-quality gates, ringdown isolation, versioned acoustic fingerprints, one-to-one recurrence comparison, modal reconstruction, realtime playable modal synthesis, Acoustic DNA, and the consumer **STRIKE → REVEAL → HEAR → PLAY** loop.

The empirical release gates remain open until representative physical and perceptual evidence passes their frozen contracts. Gate A2 defines each physical-session experiment as the first five acquisition-quality-passing attempts. Once an attempt qualifies, its analytical outcome is immutable: a failed analysis occupies its slot and cannot be retried away. Evidence schema v4 records those success/failure outcomes explicitly, and recurrence is recomputed from retained fingerprints with attempt 1 fixed as the reference.

Every physical validation object also receives a stable `specimenId`. That identity, not a display label, defines release distinctness and links repeated sessions of the same physical specimen. Relabeling an object cannot manufacture another release specimen. A true internal session error terminates the current validation session; subsequent capture uses a new session ID and retains the specimen ID when the same object is tested again.

The validation lab exports the versioned fixed-setup evidence, records blinded reconstruction reviews and device playability reviews, and keeps raw microphone PCM local. The Release Console aggregates those bundles into explicit Gate A2/B/C verdicts. Synthetic or cross-field tests never substitute for the required local evidence.

## Engineering invariants

- Scientific claims stop at estimated audible resonances from the recorded transient.
- DSP is deterministic and independent of React, the DOM, and Web Audio.
- Native capture sample rates are propagated explicitly; no algorithm assumes 48 kHz.
- Physical quantities include units in identifiers.
- Microphone PCM remains local in MVP-0.
- Reconstruction synthesizes estimated modes; recorded audio is not mixed into the model output.
- Realtime notes preserve one global modal frequency ratio and the measured decay constants.
- Acoustic DNA is a deterministic encoding of the measured fingerprint.
- Gate A2 never substitutes or replaces a qualified analytical failure.
- Physical release distinctness is keyed by stable specimen ID, not object label.
- Fatal validation-session errors cannot continue on the same worker/audio resources.
- Gate B reviews are bound to one exact passing session/attempt target per specimen.
- Gate C inherits the exact Gate B target and requires explicit cross-device evidence from passing specimens.
- Release thresholds are versioned and frozen before the corresponding empirical dataset is collected.
- The dependency graph is committed and CI/deployment use frozen lockfile installs.
- No learned model enters the pipeline until the deterministic baseline is characterized.

## Development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

The root web experience is the consumer loop. Append `?lab=1` for physical/listening evidence collection and `?release=1` for the local release-evidence console.

See `docs/SPEC.md`, `docs/DSP.md`, `docs/VALIDATION.md`, `docs/GATE_A.md`, `docs/REALIMPACT.md`, `docs/GATE_B.md`, `docs/GATE_C.md`, `docs/VALIDATION_EVIDENCE.md`, `docs/ACOUSTIC_DNA.md`, and `docs/DEPLOYMENT.md` for the implementation contracts, release gates, evidence model, and deployment path.
