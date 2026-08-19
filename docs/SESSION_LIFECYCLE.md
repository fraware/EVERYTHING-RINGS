# Empirical session lifecycle

The frozen empirical acquisition path uses explicit ownership for every asynchronous microphone startup. This is a measurement-integrity and privacy boundary. It does not change acquisition-quality thresholds, fingerprint estimation, validation evidence, campaign accounting, or Gate A/B/C scoring semantics.

## Ownership model

Every `start()` receives a monotonically increasing lifecycle generation. A later `start()`, explicit `stop()`, page departure, or component unmount invalidates the previous generation before resources are released.

Capture-worklet, analysis-worker, and realtime timing callbacks may change application state only when both their generation and their exact resource object remain current. Events queued by an older session are therefore inert after that session loses ownership.

Lifecycle decisions use a synchronous state reference instead of a stale React render closure.

## Startup resources

Microphone acquisition, `AudioContext` creation/resume, capture-graph creation, and analysis-worker construction are owned by `OpeningSessionResources` until a complete startup is transferred atomically to the active session.

Cancellation releases every partial resource already present. A microphone, graph, context, or worker that resolves after cancellation is rejected by the disposed startup scope and cleaned immediately. Cancellation of a superseded startup is silent and must not surface as a microphone-start failure.

## Active resources

Teardown is failure-isolated. Event handlers are cleared and each playback, worklet, graph, microphone-track, worker, and audio-context cleanup is attempted independently so one unavailable browser primitive cannot prevent release of the others.

`pagehide` stops the complete acquisition session, including microphone tracks, worker, graph, and `AudioContext`. Hidden-page visibility changes silence output but do not themselves reinterpret an in-flight measurement; a real page departure owns the destructive stop boundary.

## Empirical invariant

A planned physical attempt is accepted only from the currently owned session. Stale capture or analysis callbacks from a cancelled, departed, or superseded session cannot populate a newer session or alter its qualified-attempt ledger.

The lifecycle layer changes resource ownership only. It does not modify what constitutes an acquisition-quality-passing attempt or any analytical result.

## Validation

Deterministic unit tests cover generation invalidation, exact-resource ownership, stale queued callbacks, late microphone cleanup, partial startup cleanup, late graph/worker cleanup, and one-time startup-to-active ownership transfer.

The empirical browser journey covers unresolved microphone start → cancel → late-stream cleanup → fresh session ownership → cancel → unresolved start → `pagehide` → late-stream cleanup → active session → `pagehide` → microphone teardown, with no stale microphone-failure state.

The complete empirical install, typecheck, test, build, route, acquisition, permission, mobile, and post-collection review matrix remains required for any freeze that includes this lifecycle implementation.
