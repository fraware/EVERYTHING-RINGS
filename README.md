# EVERYTHING RINGS

**Hit anything. Discover how it rings.**

EVERYTHING RINGS is a local-first acoustic instrument for estimating the audible resonances of struck physical objects, reconstructing those resonances, and turning them into playable instruments.

## Current phase

MVP-0 contains the full software path from microphone capture to reveal and play: deterministic impact analysis, capture-quality gates, ringdown isolation, versioned acoustic fingerprints, one-to-one recurrence comparison, modal reconstruction, realtime playable modal synthesis, Acoustic DNA, and the consumer **STRIKE → REVEAL → HEAR → PLAY** loop. The reveal includes a Resonance Microscope for exact per-mode inspection and isolated audition, local CAPTURE ↔ MODEL listening, a Ringdown Lens that visualizes the fitted modal envelopes through time, a locally generated Acoustic DNA card, and a self-contained Acoustic Story that packages the fingerprint-derived model as an offline vertical sound-and-motion artifact without exporting microphone PCM.

The consumer path is gated in CI by a deterministic mobile browser journey that feeds a physical-style ringdown through the microphone interface and requires the real acquisition, analysis, reveal, listening, playable-instrument, share-download, and strike-again flow to complete. A separate denied-permission journey verifies clear microphone recovery, and phone-sized browser checks cover the campaign author, campaign collector, validation lab, and release console. Playback is single-source for sample auditions, recovers suspended browser audio contexts on user interaction, silences sample and realtime voices on reset/background/disposal, and exposes user-facing recovery instead of raw browser errors. Ringdown animation clamps browser-frame timing to the strike boundary, and render failures fall back to an explicit reload surface instead of an empty page.

The empirical release gates remain open until representative physical and perceptual evidence passes their frozen contracts. Gate A2 defines each physical-session experiment as the first five acquisition-quality-passing attempts. Once an attempt qualifies, its analytical outcome is immutable: a failed analysis occupies its slot and cannot be retried away. Evidence schema v5 records those success/failure outcomes explicitly, stamps the exact software commit that produced each bundle, and recomputes recurrence from retained fingerprints with attempt 1 fixed as the reference.

Every physical validation object also receives a stable `specimenId`. That identity, not a display label, defines release distinctness and links repeated sessions of the same physical specimen. Relabeling an object cannot manufacture another release specimen. An analysis-worker crash or other true internal session error terminates the current validation session; subsequent capture uses a new session ID and retains the specimen ID when the same object is tested again.

The campaign author creates a frozen `empirical-campaign-1` manifest from real physical specimen choices on the exact software revision that will collect them. The dedicated campaign collector then only arms planned specimens under their precommitted setup and authorized revision. The general validation lab hosts later blinded reconstruction and device-playability review, and the Release Console accounts for planned failures, missing specimens, extra sessions, substitutions, and unplanned evidence before evaluating Gate A2/B/C. Raw microphone PCM remains local throughout. Synthetic or cross-field tests never substitute for required physical evidence.

## Engineering invariants

- Scientific claims stop at estimated audible resonances from the recorded transient.
- DSP is deterministic and independent of React, the DOM, and Web Audio.
- Native capture sample rates are propagated explicitly; no algorithm assumes 48 kHz.
- Physical quantities include units in identifiers.
- Microphone PCM remains local in MVP-0.
- Consumer capture playback is local and never substitutes for blinded reconstruction evidence.
- Consumer sample auditions do not overlap; a new sample playback replaces the previous sample playback.
- Reset, stop, page backgrounding, and resource disposal silence sample playback and realtime voices.
- Reconstruction synthesizes estimated modes; recorded audio is not mixed into the model output.
- Ringdown visualization evaluates the fitted modal decay envelopes and adds no new analytical estimate.
- Realtime notes preserve one global modal frequency ratio and the measured decay constants.
- Acoustic DNA is a deterministic encoding of the measured fingerprint.
- Acoustic DNA cards and Acoustic Stories derive from the fingerprint/model, contain no microphone PCM, and never count as release evidence.
- Gate A2 never substitutes or replaces a qualified analytical failure.
- Physical release distinctness is keyed by stable specimen ID, not object label.
- A precommitted empirical campaign keeps planned failures, missing specimens, setup deviations, extra sessions, and unplanned specimens visible without changing release thresholds.
- Campaign authoring refuses placeholders and duplicate specimen IDs and binds the manifest to the exact running revision.
- Campaign-bound collection cannot arm a specimen absent from the manifest or a build whose software revision differs from the campaign authorization.
- Analysis-worker crashes and other fatal validation-session errors cannot continue on the same worker/audio resources.
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

Release-validation builds must set `VITE_SOFTWARE_REVISION` to the exact 40-hex Git commit. The GitHub Pages and CI workflows do this automatically; an unstamped local build can use consumer surfaces but cannot author or arm conforming release evidence collection.

The root web experience is the consumer loop. Append `?campaign-author=1` to select and freeze the real physical campaign, `?campaign=1` for precommitted campaign collection, `?lab=1` for the general validation/review lab, and `?release=1` for the local release-evidence console.

See `docs/SPEC.md`, `docs/DSP.md`, `docs/VALIDATION.md`, `docs/GATE_A.md`, `docs/REALIMPACT.md`, `docs/GATE_B.md`, `docs/GATE_C.md`, `docs/VALIDATION_EVIDENCE.md`, `docs/EMPIRICAL_CAMPAIGN.md`, `docs/ACOUSTIC_DNA.md`, `docs/ACOUSTIC_CARD.md`, `docs/RINGDOWN_LENS.md`, `docs/ACOUSTIC_STORY.md`, and `docs/DEPLOYMENT.md` for the implementation contracts, release gates, evidence model, campaign-integrity contract, visual artifacts, and deployment path.
