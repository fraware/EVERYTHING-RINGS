# Validation evidence

The validation lab exports one local JSON evidence bundle per object session. The artifact is designed to make physical recurrence, blinded reconstruction review, and device playability review auditable without exporting microphone audio.

## Schema version 3

A `validation-evidence-3` bundle contains:

- a stable session ID and creation time;
- object label and material class;
- the declared fixed-setup protocol: microphone distance, striker, strike location, and support condition;
- actual capture settings reported by the browser;
- per-strike capture-quality metrics and complete versioned acoustic fingerprints;
- one-to-one recurrence measurements against the first accepted strike;
- browser audio-thread and output-path timing diagnostics when available;
- blinded Gate B reviews, including the hidden A/B presentation order;
- Gate C reviews tied to the device ID and device class used for playback.

Raw microphone PCM is intentionally excluded. Every bundle contains `rawMicrophoneSamplesIncluded: false`, and the parser rejects a bundle that violates that invariant.

## Local release console

Open the web application with `?release=1` to use the Release Console. It imports any number of schema-v3 JSON bundles locally, deduplicates sessions by `sessionId`, evaluates the frozen `gate-a-1`, `gate-b-1`, and `gate-c-1` contracts, exposes every failed criterion, and exports one canonical release-verdict JSON artifact.

The console performs no upload. Imported evidence remains in browser memory for the current page session.

A release verdict does not reinterpret missing evidence as a pass. Gate B uses only blinded reviews from Gate A passing objects. Gate C uses only reviews from Gate B passing objects. The overall release state is `ready` only when all three gates pass.

## Versioning rule

Thresholds and evidence contracts are frozen before the corresponding release data is collected. Algorithm or renderer changes made after a failed gate require a versioned validation cycle. Historical evidence should remain interpretable under the contract that produced it.
