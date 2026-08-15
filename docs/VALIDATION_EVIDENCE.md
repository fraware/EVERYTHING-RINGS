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
- blinded Gate B reviews, including the hidden A/B presentation order and exact session/record target;
- Gate C reviews tied to the exact session/record target and to the device ID/class used for playback.

Raw microphone PCM is intentionally excluded. Every bundle contains `rawMicrophoneSamplesIncluded: false`, and the parser rejects a bundle that violates that invariant.

## Consistency checks

The fingerprints are the source of truth for Gate A recurrence. On import, the parser validates the complete fingerprint shape and diagnostics, requires sequential measurement IDs, recomputes recurrence from the fingerprints, and rejects cached recurrence rows or aggregate drift that disagree with recomputation. The release evaluator also recomputes recurrence independently instead of trusting cached medians or match counts.

Review targets must belong to their owning evidence bundle. Duplicate measurement IDs, malformed quality/timing values, invalid modal ranges, dangling recurrence targets, duplicate review IDs, and cross-session review targets are rejected.

These checks establish internal consistency. They do not constitute cryptographic attestation of the physical experiment; the protocol still relies on honest capture and review practice.

## Repeated exports from one session

A session ID identifies one immutable physical measurement core: object and material, fixed setup, capture settings, records, fingerprints, and derived recurrence evidence. Re-exporting the same session after adding listening/device reviews is supported.

The Release Console merges repeated exports only when that immutable measurement core is identical. Additional uniquely identified reviews are combined. Reusing the same session ID with changed measurement evidence, or reusing one review ID with conflicting contents, is rejected instead of silently replacing earlier evidence.

## Local release console

Open the web application with `?release=1` to use the Release Console. It imports schema-v3 JSON bundles locally, evaluates the frozen `gate-a-1`, `gate-b-1`, and `gate-c-1` contracts, exposes every failed criterion, and exports one canonical release-verdict JSON artifact.

The console performs no upload. Imported evidence remains in browser memory for the current page session.

A release verdict does not reinterpret missing evidence as a pass. Gate B uses only blinded reviews tied to eligible measurements from Gate A passing objects. Gate C uses only reviews tied to eligible measurements from Gate B passing objects. The overall release state is `ready` only when all three gates pass.

## Versioning rule

Thresholds and evidence contracts are frozen before the corresponding release data is collected. Algorithm or renderer changes made after a failed gate require a versioned validation cycle. Historical evidence should remain interpretable under the contract that produced it.
