# MVP-0 scope

The canonical loop is **STRIKE → REVEAL → HEAR → PLAY**.

Implementation order is fixed: deterministic numerical primitives; synthetic validation; STFT peak detection; peak tracking; decay fitting; versioned acoustic fingerprint; microphone acquisition and quality gates; real-object validation; modal reconstruction; playable instrument; consumer visualization.

The REVEAL surface may expose the measured fingerprint interactively, including individual-mode audition and diagnostic quantities already present in the fingerprint. It may visualize the fitted modal decay envelopes through time and locally compare the retained microphone transient with the modal reconstruction. It may also export deterministic visual artifacts derived entirely from the fingerprint. Those surfaces do not add inferred material identity, structural-mode claims, remote storage, new analytical outputs, or release evidence.

Consumer capture playback remains local and cannot satisfy blinded reconstruction-validation requirements. Presentation thresholds applied to fitted envelopes are UI thresholds only and do not redefine physical persistence or the fingerprint.

Sonic Twin, public uploads, the Resonance Atlas, machine-learned embeddings, accounts, and social features are outside MVP-0.
