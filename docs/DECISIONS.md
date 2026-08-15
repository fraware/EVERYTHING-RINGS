# Architecture decisions

## ADR-001 — Native sample rate
Analyze at the captured sample rate and propagate it explicitly.

## ADR-002 — Replaceable FFT boundary
Access `fft.js` only through `FFTBackend`, preserving a stable numerical API for a later WASM backend if profiling justifies one.

## ADR-003 — Deterministic DSP precedes learned models
No learned embedding or classifier enters MVP-0.

## ADR-004 — Local-first acquisition
MVP-0 requires no server and uploads no microphone PCM.

## ADR-005 — Modal instrument
The playable object synthesizes estimated resonant modes instead of pitch-shifting a recorded sample.

## ADR-006 — Testable acquisition kernel
Automatic onset detection and rolling capture live in a pure state machine. The AudioWorklet only adapts browser audio blocks to that kernel, so capture semantics remain deterministic and independently testable.
