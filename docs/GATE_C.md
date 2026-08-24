# Gate C — playable specimen identity

Gate C tests whether one measured physical specimen can function as a coherent chromatic instrument without losing its acoustic identity. It is post-Gate-B and microphone-free. Digital-twin instrument tests are supporting diagnostics only and are not substitutes for device listening.

The instrument chooses one anchor resonance from the fingerprint. A requested note defines one global frequency ratio, and every modal frequency is multiplied by that ratio. Relative amplitudes and measured decay constants remain unchanged. The specimen therefore retains one modal geometry across notes.

## Realtime path

After successful analysis, the browser prewarms a dedicated audio worklet. Note input sends only note parameters and a diagnostic event identifier to the continuously running modal engine. The UI thread does not synthesize a note buffer on demand.

The validation evidence keeps timing quantities separate:

- note scheduling delay from the UI event to audio-thread acknowledgement;
- browser-reported `AudioContext.baseLatency`;
- `AudioContext.outputLatency` when exposed;
- the 128-sample render quantum at the active sample rate.

These are diagnostics. Their sum is not claimed as measured acoustic end-to-end latency. Device listening or loopback measurement remains necessary.

## Eligibility and canonical plan

Only specimens that pass canonical Gate B are eligible. Gate B selects one exact `(sessionId, attemptId)` target per passing `specimenId`, and that target is the fifth qualified attempt of a passing Gate A2 session. Gate C inherits it exactly. A device review for another passing Gate A2 session or another attempt of the same specimen does not count, even when its human-readable label is identical.

Before any Gate C judgment is collected, create and freeze a `gate-c-plan-1` artifact from the canonical Gate B verdict. It binds:

- exactly four deterministically selected Gate-B-passing specimen targets;
- exactly two normalized reviewer IDs;
- exactly two distinct device IDs/classes;
- at least one mobile device among those two;
- the exact inherited Gate B `(sessionId, attemptId)` for every specimen.

The canonical matrix is therefore exactly **4 specimens × 2 reviewers × 2 devices = 16 judgments**. No required cell may be replaced after listening begins.

## Device protocol

Each of the two fixed reviewers evaluates each of the four fixed specimens on both fixed devices. Play the chromatic instrument across the useful range and record the judgment on the device producing the audio. Each review records its stable device ID/class and scores:

- identity across the useful note range, 1–5;
- timbre continuity across adjacent notes, 1–5;
- useful range in semitones;
- whether note-on latency is acceptable during direct interaction.

Include low and high transpositions where Nyquist filtering removes modes. A reviewer should judge the range that is actually musically usable, not the maximum range the UI permits.

Repeated submissions from the same normalized reviewer ID, device ID, and selected target count once defensively; the normal UI and evidence merge path treat that logical judgment as immutable and reject conflicting repeated submissions. A device ID must map consistently to one device class across the release evidence; conflicting desktop/mobile/tablet claims for the same normalized device ID invalidate Gate C.

Extra exploratory device judgments may be retained only if explicitly classified as non-canonical. They must never alter the canonical sixteen-judgment verdict.

## Frozen release contract — `gate-c-1` with `gate-c-plan-1`

These thresholds and the sampling matrix are fixed before release device-listening data is collected.

An eligible specimen passes only when all four of its canonical reviewer/device judgments are present and:

- every judgment targets the exact Gate B-selected session/attempt;
- median identity across the range is at least 4/5;
- median timbre continuity is at least 4/5;
- median useful range spans at least 12 semitones;
- every one of the four judgments accepts note-on latency.

Canonical Gate C passes only when:

- all four frozen specimen targets are represented;
- all sixteen required reviewer/device/target cells are present;
- both planned devices are represented for every specimen;
- both planned reviewers are represented on both devices for every specimen;
- the planned devices include a mobile device; and
- all four specimens pass.

Software scheduling telemetry, modal-ratio preservation, browser latency reports, numerical synthesis tests, and digital-twin transposition tests remain supporting diagnostics. They do not independently satisfy Gate C.

A renderer or realtime-engine revision made in response to failure must be versioned and re-evaluated; do not alter `gate-c-1`, the canonical plan, specimen identity, reviewer IDs, device IDs, or target provenance solely to fit an observed release set.
