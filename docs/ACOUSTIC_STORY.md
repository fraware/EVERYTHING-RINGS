# Acoustic Story

The Acoustic Story is the first living share artifact for EVERYTHING RINGS. It packages one measured fingerprint and its modal reconstruction into a single self-contained vertical HTML file that can be opened offline.

## Artifact contents

The story contains:

- the Acoustic DNA signature and fingerprint algorithm version;
- resonance count and measured frequency span;
- the same Acoustic DNA geometry used by the consumer reveal;
- per-mode fitted decay constants, relative amplitudes, and frequencies needed to animate the model;
- a PCM WAV generated from the modal reconstruction;
- inline HTML, CSS, and JavaScript required to play and animate the artifact.

It contains no microphone PCM, remote URL, tracker, external font, remote script, account identifier, or release-evidence bundle.

## Audio provenance

The consumer application renders the story audio with `renderAcousticFingerprint`. The resulting synthesized samples are encoded as mono 16-bit PCM WAV and embedded directly as a `data:audio/wav;base64,...` URL.

The story therefore plays the **model**, not the original strike. Recorded microphone audio is never embedded in the share artifact.

## Temporal visualization

When playback starts, the display reads the embedded audio element's playback clock and evaluates each mode's fitted amplitude envelope as:

`exp(-t / decaySeconds)`

The visualization also shows:

- elapsed model time;
- the mode with the largest `relativeAmplitude × envelopeFraction` at that time;
- the count of modes at or above the same explicit 10% fitted-envelope presentation threshold used by the Ringdown Lens.

The animation remains a visualization of the fitted model. Browser paint cadence is not a sample-accurate scientific measurement.

## Portability

The artifact is designed as a 9:16 vertical composition and requires no network after generation. The consumer uses the native file-sharing interface when the browser permits sharing an HTML file and falls back to a local download otherwise.

Some social platforms do not accept HTML as an upload format. The artifact is therefore an intermediate portable format on the path toward a later deterministic video export. It already establishes the harder provenance requirement: the moving visual and sound are generated entirely from the fingerprint-derived model.

## Claim boundary

The story may say that the user found measured audible resonances and may visualize their fitted model behavior. It must not claim:

- material identification;
- complete structural modal analysis;
- calibrated physical energy;
- proof of reconstruction fidelity;
- release-gate passage.

The story is a consumer/share surface. Gate A2/B/C evidence remains separate.
