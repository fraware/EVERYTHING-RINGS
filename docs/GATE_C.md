# Gate C — playable specimen identity

Gate C tests whether one measured physical specimen can function as a coherent chromatic instrument without losing its acoustic identity.

The instrument chooses one anchor resonance from the fingerprint. A requested note defines one global frequency ratio, and every modal frequency is multiplied by that ratio. Relative amplitudes and measured decay constants remain unchanged. The specimen therefore retains one modal geometry across notes.

## Realtime path

After successful analysis, the browser prewarms a dedicated audio worklet. Note input sends only note parameters and a diagnostic event identifier to the continuously running modal engine. The UI thread does not synthesize a note buffer on demand.

The validation evidence keeps timing quantities separate:

- note scheduling delay from the UI event to audio-thread acknowledgement;
- browser-reported `AudioContext.baseLatency`;
- `AudioContext.outputLatency` when exposed;
- the 128-sample render quantum at the active sample rate.

These are diagnostics. Their sum is not claimed as measured acoustic end-to-end latency. Device listening or loopback measurement remains necessary.

## Device protocol

Only specimens that pass Gate B are eligible. Gate B selects one exact `(sessionId, attemptId)` target per passing `specimenId`, and that target is the fifth qualified attempt of a passing Gate A2 session. Gate C inherits it exactly. A device review for another passing Gate A2 session or another attempt of the same specimen does not count, even when its human-readable label is identical.

Play the chromatic instrument across the useful range and record the judgment on the device producing the audio. Each review records a stable device ID/class and scores:

- identity across the useful note range, 1–5;
- timbre continuity across adjacent notes, 1–5;
- useful range in semitones;
- whether note-on latency is acceptable during direct interaction.

Include low and high transpositions where Nyquist filtering removes modes. A reviewer should judge the range that is actually musically usable, not the maximum range the UI permits.

Repeated submissions from the same normalized reviewer ID, device ID, and selected target count once defensively; the normal UI and evidence merge path treat that logical judgment as immutable and reject conflicting repeated submissions. A device ID must map consistently to one device class across the release evidence; conflicting desktop/mobile/tablet claims for the same normalized device ID invalidate Gate C.

## Frozen release contract — `gate-c-1`

These thresholds are fixed before release device-listening data is collected.

An eligible specimen passes when:

- every counted review targets the exact Gate B-selected session/attempt for that specimen;
- median identity across the range is at least 4/5;
- median timbre continuity is at least 4/5;
- median useful range spans at least 12 semitones;
- every counted device review for that specimen accepts note-on latency.

Gate C passes when at least four Gate B specimens have eligible device reviews and all four pass. **Device diversity is computed only from reviews attached to Gate C-passing specimens:** those passing-specimen reviews must cover at least two distinct normalized device IDs, and at least one of those devices must be consistently identified as mobile. A mobile review attached only to a specimen that fails Gate C cannot satisfy the release mobile/device-diversity requirement.

Device-class consistency is checked across all eligible selected-target reviews, including reviews for specimens that fail Gate C. A contradictory device identity remains an evidence-integrity failure even when that review does not contribute to the passing-specimen device count.

Software scheduling telemetry, modal-ratio preservation, and browser latency reports remain supporting diagnostics. They do not independently satisfy Gate C.

A renderer or realtime-engine revision made in response to failure must be versioned and re-evaluated; do not alter `gate-c-1`, specimen identity, or target provenance solely to fit an observed release set.
