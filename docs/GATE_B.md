# Gate B — modal reconstruction

Gate B asks whether the estimated modal fingerprint is sufficient to reconstruct the perceptual identity of a struck physical specimen.

The baseline renderer is deliberately constrained. Each accepted mode contributes a sinusoid at its estimated frequency with its measured exponential decay. Relative modal amplitudes use the fixed renderer transform, a short attack suppresses synthesis clicks, and the final waveform is normalized. No recorded audio is mixed into the reconstruction.

## Blinded protocol

Only physical specimens with a passing Gate A2 session are eligible. Gate A2 passes only after exactly five qualified attempts all succeed under the frozen physical contract. Gate B is grouped by stable `specimenId`, not by display label.

The review target is the **fifth qualified attempt** of one passing Gate A2 session for that specimen. Each review stores the object label, session ID, and attempt ID. The owning evidence bundle binds that session to its `specimenId`; a review targeting another session, another attempt, or an analytically failed attempt does not count.

If one specimen has more than one passing Gate A2 session, all counted Gate B reviewers for that specimen must hear the **same single session/attempt target**. Reviews from different passing sessions are never pooled. If submitted Gate B reviews for one specimen span multiple eligible targets, that specimen's Gate B state remains OPEN. A label alias on another session does not create another Gate B specimen.

A reviewer starts a randomized A/B trial and sees only `A` and `B`; the application stores the hidden original/reconstruction presentation order for audit. Reviewers score:

- same-specimen identity, 1–5;
- brightness match, 1–5;
- decay-character match, 1–5;
- artifact severity, 1–5, where 1 means none and 5 means severe.

At least two distinct reviewer IDs are required per specimen on the selected target. Reviewer IDs are normalized for counting, so capitalization or surrounding whitespace cannot make one reviewer count twice. An unblinded judgment does not count toward the release contract. A reviewer/target judgment is immutable once submitted; conflicting repeated submissions are rejected by the evidence parser and merge path.

## Frozen release contract — `gate-b-1`

These thresholds are fixed before release listening data is collected.

An eligible specimen passes when:

- exactly one passing Gate A2 session/attempt target is represented by its counted review set;
- at least two blinded reviewers are present on that target;
- median same-specimen identity is at least 4/5;
- median brightness match is at least 3/5;
- median decay-character match is at least 3/5;
- median artifact severity is at most 2/5.

Gate B passes when at least five Gate A2 specimens have eligible blinded reviews, at least four specimens pass, and the passing reconstruction set contains metal, glass, and ceramic examples.

The numerical regression suite verifies deterministic output, attack continuity, measured decay preservation, and Nyquist filtering. Those checks remain necessary and remain insufficient for Gate B.

Failed listening results remain part of the evidence. Do not change scoring thresholds, renderer parameters, specimen IDs, or review targets solely to convert the existing release set into a pass; a renderer revision requires a new algorithm/versioned evaluation cycle.
