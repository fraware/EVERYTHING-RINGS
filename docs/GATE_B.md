# Gate B — modal reconstruction

Gate B asks whether the estimated modal fingerprint is sufficient to reconstruct the perceptual identity of a struck physical specimen. It is post-collection and microphone-free. Digital-twin rendering tests are supporting diagnostics only and are not substitutes for blinded human judgments.

The baseline renderer is deliberately constrained. Each accepted mode contributes a sinusoid at its estimated frequency with its measured exponential decay. Relative modal amplitudes use the fixed renderer transform, a short attack suppresses synthesis clicks, and the final waveform is normalized. No recorded audio is mixed into the reconstruction.

## Eligibility and canonical target selection

Only physical specimens with a passing Gate A2 session are eligible. Gate A2 passes only after exactly five qualified attempts all succeed under the frozen physical contract. Gate B is grouped by stable `specimenId`, not by display label.

The review target is the **fifth qualified attempt** of one passing Gate A2 session for that specimen. Each review stores the object label, session ID, and attempt ID. The owning evidence bundle binds that session to its `specimenId`; a review targeting another session, another attempt, or an analytically failed attempt does not count.

Before any Gate B judgment is collected, create and freeze a `gate-b-plan-1` artifact from the canonical Gate A2 verdict. Exactly five specimens are selected deterministically:

1. the lowest deterministic selection digest among passing metal specimens;
2. the lowest deterministic selection digest among passing glass specimens;
3. the lowest deterministic selection digest among passing ceramic specimens;
4. the two lowest deterministic selection digests among the remaining passing specimens.

The plan binds the exact Gate A software revision, the five `(specimenId, sessionId, attemptId)` targets, and exactly two normalized reviewer IDs. Target selection is not changed after listening begins.

If one specimen has more than one passing Gate A2 session, the plan binds one exact session/attempt target. Reviews from different passing sessions are never pooled. A label alias on another session does not create another Gate B specimen.

## Blinded protocol

Exactly the two reviewer IDs frozen in the plan must each review all five canonical targets, yielding exactly ten canonical judgments. A reviewer starts a randomized A/B trial and sees only `A` and `B`; the application stores the hidden original/reconstruction presentation order for audit. Reviewers score:

- same-specimen identity, 1–5;
- brightness match, 1–5;
- decay-character match, 1–5;
- artifact severity, 1–5, where 1 means none and 5 means severe.

Reviewer IDs are normalized for counting, so capitalization or surrounding whitespace cannot make one reviewer count twice. An unblinded judgment does not count toward the release contract. A reviewer/target judgment is immutable once submitted; conflicting repeated submissions are rejected by the evidence parser and merge path.

Extra exploratory judgments may be retained only if they are explicitly classified as non-canonical. They must never alter the canonical ten-judgment release verdict.

## Frozen release contract — `gate-b-1` with `gate-b-plan-1`

These thresholds and the sampling matrix are fixed before release listening data is collected.

An eligible canonical specimen passes when:

- it is one of the five targets frozen in the Gate B plan;
- both and only the two fixed reviewers have one blinded judgment on that exact target;
- median same-specimen identity is at least 4/5;
- median brightness match is at least 3/5;
- median decay-character match is at least 3/5;
- median artifact severity is at most 2/5.

Canonical Gate B passes only when:

- all five frozen targets are represented;
- all ten required judgments are present;
- no required reviewer/target cell is missing or substituted;
- at least four of the five specimens pass the score thresholds; and
- the passing reconstruction set contains metal, glass, and ceramic examples.

The numerical regression suite verifies deterministic output, attack continuity, measured decay preservation, and Nyquist filtering. Digital-twin reconstruction tests additionally exercise objective software behavior. Those checks remain necessary and remain insufficient for Gate B.

Failed listening results remain part of the evidence. Do not change scoring thresholds, renderer parameters, specimen IDs, reviewer IDs, target selection, or the sampling matrix solely to convert the existing release set into a pass; a renderer or protocol revision requires a new versioned evaluation cycle.
