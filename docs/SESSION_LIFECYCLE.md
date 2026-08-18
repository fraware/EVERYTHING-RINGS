# Consumer session lifecycle

The consumer microphone session uses explicit ownership for every asynchronous startup. This is a product reliability and privacy boundary on `post-freeze-development`; it does not change acquisition thresholds, fingerprint estimation, validation evidence, or empirical gate semantics.

## Ownership model

Every `start()` receives a monotonically increasing lifecycle generation. `stop()`, unmount, a new `start()`, or a shared-link route transition invalidates the previous generation before resources are released.

A callback is allowed to change consumer state only when both conditions hold:

1. its lifecycle generation is still current;
2. its exact `SessionResources` object is still the active resource owner.

Capture-worklet messages, analysis-worker success/failure/error messages, and realtime instrument timing callbacks therefore cannot re-enter the UI after their session has been superseded.

React render state is not used as the source of truth for lifecycle decisions. The hook maintains a synchronous state reference so a callback captured by an earlier render can still distinguish an active session from an already-idle one.

## Startup resources

Microphone acquisition, `AudioContext.resume()`, capture-graph creation, and analysis-worker construction occur before a session becomes active. These partial resources are tracked by `OpeningSessionResources`.

Cancellation disposes whatever exists immediately. If a delayed operation returns after cancellation, attaching that late resource to the already-disposed startup scope releases it immediately. This covers a microphone stream resolving after cancel as well as graph/worker resources that complete after their generation has lost ownership.

Startup cancellation is silent. A rejection from a superseded generation must not be converted into a microphone failure message.

## Active resources

Disposal clears event handlers before disconnecting resources, then stops sample playback and realtime notes, disconnects the graph, stops all microphone tracks, terminates the analysis worker, and closes the audio context.

Queued events are still guarded by lifecycle generation and exact resource identity, so cleanup does not rely on event-handler removal alone.

`pagehide` stops the complete consumer session. A page transition therefore cannot leave microphone capture or an `AudioContext` owned by the departing page.

## Validation

Deterministic unit coverage exercises:

- generation invalidation and start → cancel → start ownership;
- exact-resource callback ownership;
- queued callback no-op after invalidation;
- late microphone cleanup after cancellation;
- partial microphone/context cleanup;
- late graph/worker cleanup;
- one-time transfer from startup ownership to active-session ownership.

The browser lifecycle journey additionally exercises an unresolved microphone request, cancellation before resolution, cleanup of the late stream, a fresh subsequent session owner, cancellation of that owner, and a shared-link route superseding another unresolved startup without stale microphone failure UI.

The complete existing consumer, history, Acoustic Capsule, permission, mobile, build, typecheck, and test matrix remains the integration gate.
