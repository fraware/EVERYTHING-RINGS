# Ringdown Lens

The Ringdown Lens makes the fitted temporal behavior already present in `AcousticFingerprintV1` visible in the consumer reveal. It also places the analyzed microphone ringdown beside the modal reconstruction for direct local listening.

## Temporal model

For a mode with fitted decay constant `decaySeconds`, the lens displays the same exponential amplitude-envelope law used by modal reconstruction. At elapsed time `t`, the displayed envelope fraction is `exp(-t / decaySeconds)`.

The scrubber spans the fingerprint duration. It does not estimate new decay parameters, extrapolate material properties, or re-analyze the microphone signal. It only evaluates the fitted decay constants already recorded in the fingerprint.

The **MODELED DOMINANT** readout selects the mode with the largest `relativeAmplitude × envelopeFraction` at the displayed time. This is a property of the reconstructed modal model, not a calibrated loudness, energy, or material measurement.

The **≥ 10% ENVELOPE** count is an explicit presentation threshold. Falling below that threshold does not mean a physical resonance has stopped. A faint visual trace remains after modes fall below the threshold so every measured mode stays selectable.

## Capture ↔ model listening

The consumer surface may audition two separate local signals:

- **CAPTURE** reuses `extractImpactRingdown`, the deterministic preprocessing path used by analysis, so the audition starts at the same refined-onset-plus-analysis-delay boundary as the measured signal. Gain-only peak matching then brings that isolated microphone ringdown to the modal renderer's fixed output peak.
- **MODEL** synthesizes the estimated modes from the fingerprint. Recorded microphone audio is never mixed into this reconstruction.

Peak matching removes a gross device/input-gain difference from the consumer comparison. It is not perceptual loudness matching and does not make the two signals physically calibrated.

The comparison is transparent consumer listening. It is not blinded, scored, or admissible as Gate B evidence. The frozen Gate B protocol remains the only release-evidence path for reconstruction fidelity.

Microphone PCM remains local. Capture playback does not alter the Acoustic DNA share artifact and does not add PCM to exports.

## Animation timing

**WATCH + HEAR MODEL** starts the model playback and advances the visual ringdown over the same nominal model duration. The visual clock follows browser animation timing. Device and browser audio-output latency can shift the audible onset relative to the display, so the feature does not claim sample-accurate audiovisual synchronization.

## Claim boundary

The Ringdown Lens visualizes fitted audible-resonance behavior from one recorded transient. It does not claim complete structural modes, material identity, physical energy, calibrated perceptual loudness, or persistence beyond the measured model.
