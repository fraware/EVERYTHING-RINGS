# Gate B — modal reconstruction

Gate B asks whether the estimated modal fingerprint is sufficient to reconstruct the perceptual identity of a struck object.

The baseline renderer is deliberately constrained. Each accepted mode contributes a sinusoid at its estimated frequency with its measured exponential decay. Relative modal amplitudes use the fixed renderer transform, a short attack suppresses synthesis clicks, and the final waveform is normalized. No recorded audio is mixed into the reconstruction.

## Blinded protocol

Only objects that pass Gate A are eligible. The review target is the exact fifth accepted measurement of a passing Gate A session. Each review stores the object label, session ID, and record ID; a review targeting another session or measurement does not count.

If an object has more than one passing Gate A session, all counted Gate B reviewers for that object must hear the **same single measurement target**. Reviews from different passing sessions are not pooled. If submitted Gate B reviews for one object span multiple eligible targets, that object's Gate B state remains OPEN until one coherent target has the required review evidence.

A reviewer starts a randomized A/B trial and sees only `A` and `B`; the application stores the hidden original/reconstruction presentation order for audit. Reviewers score:

- same-object identity, 1–5;
- brightness match, 1–5;
- decay-character match, 1–5;
- artifact severity, 1–5, where 1 means none and 5 means severe.

At least two distinct reviewer IDs are required per object on that one selected target. Reviewer IDs are normalized for counting, so capitalization or surrounding whitespace cannot make one reviewer count twice. An unblinded judgment does not count toward the release contract. A reviewer/target judgment is immutable once submitted; conflicting repeated submissions are rejected by the evidence merge path.

## Frozen release contract — `gate-b-1`

These thresholds are fixed before release listening data is collected.

An eligible object passes when:

- exactly one passing-session measurement target is represented by its counted review set;
- at least two blinded reviewers are present on that target;
- median same-object identity is at least 4/5;
- median brightness match is at least 3/5;
- median decay-character match is at least 3/5;
- median artifact severity is at most 2/5.

Gate B passes when at least five Gate A objects have eligible blinded reviews, at least four objects pass, and the passing reconstruction set contains metal, glass, and ceramic examples.

The numerical regression suite verifies deterministic output, attack continuity, measured decay preservation, and Nyquist filtering. Those checks remain necessary and remain insufficient for Gate B.

Failed listening results remain part of the evidence. Do not change the scoring thresholds or renderer parameters solely to convert the existing release set into a pass; a renderer revision requires a new algorithm/versioned evaluation cycle.
