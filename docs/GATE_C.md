# Gate C — playable object identity

Gate C tests whether one measured object can function as a coherent chromatic instrument without losing its acoustic identity.

The instrument chooses a single anchor resonance from the fingerprint using confidence-weighted relative amplitude inside a practical anchor band. A requested note defines one global frequency ratio, and every modal frequency is multiplied by that same ratio. Relative amplitudes and measured decay constants remain unchanged. The instrument therefore preserves the object's internal modal geometry instead of pitch-shifting recorded audio.

## Realtime path

After a successful analysis, the browser prewarms a dedicated audio worklet. Note input sends only the MIDI note, velocity, and a diagnostic event identifier to a continuously running block-based modal engine. The UI thread does not render a note buffer on demand.

The validation lab records separate timing quantities:

- **note scheduling**: context-time delay from the UI note event to acknowledgement in the audio rendering thread;
- **base latency**: the browser's `AudioContext.baseLatency` report;
- **output latency**: `AudioContext.outputLatency` when the browser exposes it;
- **render quantum**: 128 samples at the active context sample rate.

These values diagnose different parts of the path. Their sum is not treated as a measured acoustic end-to-end latency. Final device validation still requires listening or loopback measurement.

## Validation protocol

Use objects that passed Gate A and have acceptable Gate B reconstructions. Play a fixed chromatic sequence over at least one octave. Compare adjacent notes for continuity of timbre, decay character, and modal balance. Include low and high transpositions where Nyquist filtering removes modes.

Gate C passes only if the object remains recognizably itself across the useful note range and note onset latency is acceptable in the browser implementation. Numerical ratio preservation and software scheduling telemetry alone are insufficient.
