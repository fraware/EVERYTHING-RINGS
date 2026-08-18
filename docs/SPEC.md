# MVP-0 scope

The canonical loop is **STRIKE → REVEAL → HEAR → PLAY**.

Implementation order is fixed: deterministic numerical primitives; synthetic validation; STFT peak detection; peak tracking; decay fitting; versioned acoustic fingerprint; microphone acquisition and quality gates; real-object validation; modal reconstruction; playable instrument; consumer visualization.

The REVEAL surface may expose the measured fingerprint interactively, including individual-mode audition and diagnostic quantities already present in the fingerprint. It may visualize the fitted modal decay envelopes through time and locally compare the deterministically isolated microphone ringdown used by analysis with the modal reconstruction. It may also export deterministic visual artifacts derived entirely from the fingerprint. Those surfaces do not add inferred material identity, structural-mode claims, remote storage, new analytical outputs, or release evidence.

Consumer capture playback remains local and cannot satisfy blinded reconstruction-validation requirements. Presentation thresholds applied to fitted envelopes are UI thresholds only and do not redefine physical persistence or the fingerprint.

Post-freeze consumer development may preserve successful fingerprint observations locally, reopen them as fingerprint-derived instruments, compare two observations descriptively, and transmit a bounded fingerprint through an Acoustic Capsule share link. These are consumer reuse and transport layers only. They do not create canonical physical-object identity, authenticated provenance, public persistence, release evidence, or calibrated same/different-object inference.

Acoustic Capsule v1 uses fragment-only fingerprint transport so another browser can see Acoustic DNA and synthesize the shared fingerprint without receiving microphone PCM or requesting microphone access. A capsule is untrusted user-shareable data and must be parsed under strict version, size, shape, algorithm, numeric, and signature-consistency bounds.

Sonic Twin identity claims, public uploads, the Resonance Atlas, machine-learned embeddings, accounts, generic social feeds, and remotely persisted public object records remain outside MVP-0. Any future public publishing layer requires its own privacy, moderation, provenance, persistence, and schema-migration design.
