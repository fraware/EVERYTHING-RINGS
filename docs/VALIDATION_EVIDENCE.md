# Validation evidence

The validation lab exports one local JSON evidence bundle per physical measurement session. The artifact is designed to make recurrence, blinded reconstruction review, and device playability review auditable without exporting microphone audio.

## Schema version 4

A `validation-evidence-4` bundle contains:

- a stable session ID and creation time;
- a required stable physical `specimenId`, plus human-readable object label and material class;
- the declared fixed-setup protocol: microphone distance, striker, strike location, and support condition;
- actual capture settings reported by the browser;
- exactly the retained **qualified attempts**, where qualification means the acquisition-quality gate passed;
- per-attempt capture-quality metrics;
- one terminal analysis outcome per qualified attempt: a complete versioned `er-dsp-1` fingerprint or an explicit analytical failure reason;
- one-to-one recurrence measurements using successful attempt 1 as the fixed reference;
- browser audio-thread and output-path timing diagnostics when available;
- blinded Gate B reviews, including the hidden A/B presentation order and exact session/attempt target;
- Gate C reviews tied to the exact session/attempt target and to the device ID/class used for playback.

Raw microphone PCM is intentionally excluded. Every bundle contains `rawMicrophoneSamplesIncluded: false`, and the parser rejects a bundle that violates that invariant.

## Physical specimen identity

`specimenId` is the release identity axis. It identifies one physical test specimen across measurement sessions. The object label is descriptive metadata only.

The same physical specimen must reuse the same normalized `specimenId` even if its display label changes. Multiple sessions with the same specimen ID can support repeatability and listening evaluation, but they still represent one specimen for release distinctness. Reusing a specimen ID with conflicting material classes is an evidence-integrity failure.

The parser requires a non-empty specimen ID. The release evaluator groups Gate A distinctness and Gate B/C specimen provenance through this identity, so relabeling one object cannot manufacture extra release specimens.

## Qualified-attempt invariant

Acquisition-quality failures are not retained in the five-attempt Gate A2 experiment. Once acquisition quality passes, the physical attempt is final and receives the next sequential attempt ID. Its subsequent analysis outcome cannot be removed or replaced. `NO_STABLE_RESONANCES`, `SIGNAL_TOO_SHORT`, and `ANALYSIS_INTERNAL_ERROR` are retained analytical outcomes.

This is the principal semantic difference from the superseded record-only schema v3. Schema v4 makes analytical failures visible so release evaluation cannot select only successful analyses.

A true session-level internal error terminates that physical session in the validation UI. Retained evidence can be exported, but another qualified attempt is not permitted on the same potentially compromised worker/audio resources. Further capture uses a new session ID; if it is the same physical specimen, the same `specimenId` is retained.

## Consistency checks

The retained attempts and successful fingerprints are the source of truth for Gate A2. On import, the parser validates specimen identity, the complete fingerprint shape and diagnostics, requires sequential qualified-attempt IDs, recomputes recurrence from the retained successful fingerprints, and rejects cached recurrence rows or aggregate drift that disagree with recomputation. The release evaluator also recomputes recurrence independently instead of trusting cached medians or match counts.

The first qualified attempt is the fixed recurrence reference. If it fails analysis, no later attempt is substituted. Recurrence cache entries therefore exist only for later successful attempts when attempt 1 itself succeeded.

Review targets must belong to successful attempts in their owning evidence bundle. Duplicate or non-sequential attempt IDs, malformed quality/timing values, invalid modal ranges, duplicate review IDs, duplicate logical reviewer judgments, dangling review targets, and cross-session review targets are rejected. Device IDs must also map consistently to one device class.

These checks establish internal consistency and make accidental or stale evidence fail closed. They do not constitute cryptographic attestation of the physical experiment; the protocol still relies on honest specimen identification, capture, and review practice.

## Repeated exports from one session

A session ID identifies one immutable physical measurement core: specimen identity, object label and material, fixed setup, capture settings, qualified attempts, analytical outcomes, fingerprints, and derived recurrence evidence. Re-exporting the same session after adding listening/device reviews is supported.

The Release Console merges repeated exports only when that immutable measurement core is identical. Additional uniquely identified reviews are combined. Reusing the same session ID with changed specimen identity or qualified-attempt evidence, changing a retained failure into a success, reusing one review ID with conflicting contents, or submitting a conflicting second logical judgment is rejected instead of silently replacing earlier evidence.

## Local release console

Open the web application with `?release=1` to use the Release Console. It imports schema-v4 JSON bundles locally, evaluates the frozen `gate-a-2`, `gate-b-1`, and `gate-c-1` contracts, exposes every failed criterion, and exports one canonical release-verdict JSON artifact.

The console performs no upload. Imported evidence remains in browser memory for the current page session.

A release verdict does not reinterpret missing evidence as a pass. Gate A2 release distinctness is counted by normalized physical specimen ID. Gate B uses only blinded reviews tied to the final eligible attempt of Gate A2-passing sessions and groups those sessions by specimen. Gate C uses only reviews tied to the exact measurement target selected by Gate B. The overall release state is `ready` only when all three gates pass.

Release metrics preserve those ontology levels explicitly: Gate A reports `passingSessionCount` and `distinctPassingSpecimenCount`; Gate B and Gate C report `passingSpecimenCount`. A repeated passing session for one specimen therefore cannot be mistaken for another passing physical specimen in the machine-readable verdict.

## Versioning rule

Thresholds and evidence contracts are frozen before the corresponding release data is collected. The v4/A2 migration and specimen-identity migration occurred before the release physical dataset was accepted because the earlier forms could encode selection or identity ambiguity. Once Gate A2 release data collection starts, threshold, attempt, or specimen-identity protocol changes require another explicit contract version.

Algorithm or renderer changes made after a failed gate require a versioned validation cycle. Historical evidence should remain interpretable under the contract that produced it.
