# Capture comparison

Resonance Diff is a local consumer view for comparing two saved capture observations. It is designed to expose measurable differences without turning those observations into an object-identification system.

## Comparison unit

The unit of comparison is one `ConsumerCaptureRecord` against another `ConsumerCaptureRecord`.

Each record remains one successful recorded transient. Selecting two records creates ephemeral UI state only. Comparison never modifies either stored record, creates a relationship between them, merges them, or assigns a shared object identifier.

Two records with the same Acoustic DNA signature remain two records. Equal signatures are allowed and do not trigger deduplication.

## Exposed observables

For each fingerprint the view reports:

- resonance count;
- measured frequency span;
- strongest-at-strike mode frequency;
- longest fitted decay constant;
- capture time;
- Acoustic DNA signature;
- fingerprint algorithm version.

The two Acoustic DNA encodings are shown side by side. A and B model buttons synthesize the stored fingerprints independently; original microphone audio is unavailable because local history never retains PCM.

No aggregate similarity percentage or same/different verdict is computed.

## Mutual-nearest frequency pairs

The view also computes reciprocal nearest neighbors in log-frequency distance.

For each mode in capture A, the algorithm finds the nearest mode in capture B by absolute cents distance. The same operation is computed from B to A. A pair is emitted only when each mode selects the other. This makes the relation deterministic, symmetric, and one-to-one without requiring an assignment penalty or a hidden distance threshold.

The pairing intentionally has no maximum distance. A reciprocal nearest pair can be thousands of cents apart. The displayed distance remains visible instead of being converted into a match/no-match category.

A mutual-nearest pair is a navigation aid. It does not establish that the two resonances share a physical source, structural mode, material, specimen, or object identity.

## Revision boundary

If the two fingerprints use different algorithm versions, Resonance Diff renders an explicit warning. Differences may then reflect the analysis revision as well as differences in the recorded transients.

Software revision is retained per record for provenance. Consumer comparison does not normalize across revisions or reinterpret historical fingerprints.

## Audio and privacy

A/B listening uses the saved-capture output-only audio controller. Starting comparison does not request microphone access, initialize acquisition, create a capture worklet, or run the analysis worker. Selecting B silences A before B playback begins, and vice versa. Page hiding, document backgrounding, back navigation, and unmount silence or dispose comparison audio.

## Evidence boundary

Resonance Diff is a consumer inspection surface. Its observables and mutual-nearest frequency pairs are not Gate A2, Gate B, or Gate C evidence and do not modify release evaluation. Validation recurrence retains its separate frozen contract.

Future Sonic Twin or Resonance Atlas work must define and validate its own identity or retrieval semantics. Resonance Diff deliberately does not precommit those semantics through a consumer-facing score.
