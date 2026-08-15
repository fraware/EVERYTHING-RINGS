# Validation evidence

The browser validation lab can export a local JSON evidence bundle after one or more accepted strikes. The bundle is designed for comparing devices, objects, and repeated-measurement sessions without exporting microphone audio.

Each bundle contains the actual capture settings reported by the browser, per-strike capture-quality metrics, complete versioned acoustic fingerprints, and one-to-one recurrence measurements against the first accepted strike. It also records the aggregate modal drift in cents when repeated measurements are available.

Schema version 2 additionally records realtime audio timing when available: browser-reported base/output latency, render-quantum duration, and the most recent UI-to-audio-thread note scheduling delay. These remain separate diagnostics and are not presented as a measured acoustic end-to-end latency.

Raw microphone PCM is intentionally excluded. The export contains `rawMicrophoneSamplesIncluded: false` as an explicit invariant.

Evidence bundles are diagnostic artifacts. A single session does not establish Gate A, Gate B, or Gate C. Release decisions should aggregate representative objects, devices, and listening evaluations under the protocols in `docs/VALIDATION.md`, `docs/GATE_B.md`, and `docs/GATE_C.md`.
