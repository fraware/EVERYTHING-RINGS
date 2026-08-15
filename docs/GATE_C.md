# Gate C — playable object identity

Gate C tests whether one measured object can function as a coherent chromatic instrument without losing its acoustic identity.

The instrument chooses one anchor resonance from the fingerprint. A requested note defines one global frequency ratio, and every modal frequency is multiplied by that ratio. Relative amplitudes and measured decay constants remain unchanged. The object therefore retains one modal geometry across notes.

## Realtime path

After successful analysis, the browser prewarms a dedicated audio worklet. Note input sends only note parameters and a diagnostic event identifier to the continuously running modal engine. The UI thread does not synthesize a note buffer on demand.

The validation evidence keeps timing quantities separate:

- note scheduling delay from the UI event to audio-thread acknowledgement;
- browser-reported `AudioContext.baseLatency`;
- `AudioContext.outputLatency` when exposed;
- the 128-sample render quantum at the active sample rate.

These are diagnostics. Their sum is not claimed as measured acoustic end-to-end latency. Device listening or loopback measurement remains necessary.

## Device protocol

Only objects that pass Gate B are eligible. Play the chromatic instrument across the useful range and record the judgment on the device producing the audio. Each review records a stable device ID/class and scores:

- identity across the useful note range, 1–5;
- timbre continuity across adjacent notes, 1–5;
- useful range in semitones;
- whether note-on latency is acceptable during direct interaction.

Include low and high transpositions where Nyquist filtering removes modes. A reviewer should judge the range that is actually musically usable, not the maximum range the UI permits.

## Frozen release contract — `gate-c-1`

These thresholds are fixed before release device-listening data is collected.

An eligible object passes when:

- median identity across the range is at least 4/5;
- median timbre continuity is at least 4/5;
- median useful range spans at least 12 semitones;
- every submitted device review for that object accepts note-on latency.

Gate C passes when at least four Gate B objects have device reviews and all four pass, the evidence covers at least two distinct device IDs, and at least one review comes from a mobile device.

Software scheduling telemetry, modal-ratio preservation, and browser latency reports remain supporting diagnostics. They do not independently satisfy Gate C.

A renderer or realtime-engine revision made in response to failure must be versioned and re-evaluated; do not alter `gate-c-1` solely to fit an observed release set.
