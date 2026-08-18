# Saved captures

Saved captures are a local consumer convenience layer over `AcousticFingerprintV1`. They preserve a successful discovery after the live microphone session ends without preserving microphone PCM or defining a canonical physical object.

## Record contract

A consumer history record stores:

- schema version;
- capture timestamp;
- deterministic Acoustic DNA signature;
- fingerprint algorithm version through the embedded fingerprint;
- exact software revision when the running build is stamped;
- the complete `AcousticFingerprintV1` required to inspect, reconstruct, and play the measured-mode model.

The record does not store microphone samples, geolocation, inferred material identity, user identity, release evidence, or a specimen identifier.

History is bounded on-device browser storage. Malformed records are rejected during loading, duplicate record IDs are ignored, and storage read/write failures cannot interrupt the live strike/reveal path.

## Identity boundary

One record represents one successful capture observation.

A fingerprint signature is deterministic shorthand for the encoded modal fingerprint. It is not a physical-object identifier and is not a deduplication key. Two strikes may have equal signatures and remain separate capture observations. Conversely, two captures of one physical object may differ.

Consumer history does not infer specimen identity, merge captures, establish Sonic Twins, create Resonance Atlas objects, or provide release distinctness. Physical validation identity continues to use the separate stable `specimenId` contract inside empirical evidence.

## Reopened playback

A saved capture may be reopened after a reload. The reopened view can:

- inspect the stored Acoustic DNA and per-mode diagnostics;
- synthesize the complete measured-mode reconstruction;
- synthesize an individual stored mode;
- initialize the existing realtime modal instrument lazily and play the stored fingerprint chromatically;
- generate the deterministic Acoustic DNA share artifact.

The original microphone recording cannot be replayed because it was intentionally not retained. The saved view renders that absence explicitly as `CAPTURE NOT STORED` and labels every available sound as fingerprint-derived synthesis.

Saved playback owns an independent output-only Web Audio lifecycle. Model and mode audition create an `AudioContext` only after user interaction. Realtime instrument resources load only on the first chromatic note. Reopening a saved capture never initializes microphone acquisition, a capture worklet, or the analysis worker.

Page hiding, document backgrounding, back navigation, and component disposal silence saved playback. Disposal closes the saved output context and disconnects realtime resources.

## Evidence boundary

Saved captures and any audio synthesized from them are consumer artifacts. They never count as Gate A2, Gate B, or Gate C evidence. A saved record cannot reconstruct the original acquisition conditions and cannot substitute for the immutable validation-evidence contracts.
