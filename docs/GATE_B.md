# Gate B — modal reconstruction

Gate B asks whether the estimated modal fingerprint is sufficient to reconstruct the perceptual identity of a struck object.

The baseline renderer is deliberately constrained. Each accepted mode contributes a sinusoid at its estimated frequency with its measured exponential decay. Relative modal amplitudes use the fixed renderer transform, a short attack suppresses synthesis clicks, and the final waveform is normalized. No recorded audio is mixed into the reconstruction.

## Blinded protocol

Only objects that pass Gate A are eligible. A reviewer starts a randomized A/B trial and sees only `A` and `B`; the application stores the hidden original/reconstruction presentation order for audit. Reviewers score:

- same-object identity, 1–5;
- brightness match, 1–5;
- decay-character match, 1–5;
- artifact severity, 1–5, where 1 means none and 5 means severe.

At least two distinct reviewer IDs are required per object. An unblinded judgment does not count toward the release contract.

## Frozen release contract — `gate-b-1`

These thresholds are fixed before release listening data is collected.

An eligible object passes when:

- at least two blinded reviewers are present;
- median same-object identity is at least 4/5;
- median brightness match is at least 3/5;
- median decay-character match is at least 3/5;
- median artifact severity is at most 2/5.

Gate B passes when at least five Gate A objects have blinded reviews, at least four objects pass, and the passing reconstruction set contains metal, glass, and ceramic examples.

The numerical regression suite verifies deterministic output, attack continuity, measured decay preservation, and Nyquist filtering. Those checks remain necessary and remain insufficient for Gate B.

Failed listening results remain part of the evidence. Do not change the scoring thresholds or renderer parameters solely to convert the existing release set into a pass; a renderer revision requires a new algorithm/versioned evaluation cycle.
