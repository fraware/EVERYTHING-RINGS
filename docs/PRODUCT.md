# Product principles

EVERYTHING RINGS should feel simpler than the science underneath it.

The product promise is:

**Hit anything. Discover how it rings.**

The deeper technical system may estimate modes, preserve provenance, evaluate repeatability, compare reconstructions, and enforce release contracts. The first-use consumer experience should still feel like one surprising physical interaction followed by an immediate reveal.

## 1. Magic first, rigor underneath

A consumer should not need to understand STFTs, peak tracking, decay fitting, evidence schemas, or release gates to use the product.

The primary path is:

**STRIKE → REVEAL → HEAR → PLAY**

Every additional consumer feature should strengthen one of four outcomes:

- make the first strike easier;
- make the reveal more legible or surprising;
- make the discovered fingerprint more reusable;
- make the discovery easier to transmit to another person.

Scientific rigor is part of the product quality because the reveal is only magical when it remains trustworthy. Rigor belongs in architecture, validation, provenance, and carefully chosen interpretation copy; it should not turn the primary surface into an operator console.

## 2. One dominant action per stage

At each stage, the next intended action should be visually obvious.

Examples:

- landing → `START LISTENING`;
- armed → strike the object;
- reveal → `PLAY IT` and `SHARE LINK` are the highest-value continuations;
- shared ring → `HEAR THIS RING`;
- after hearing → `PLAY IT`;
- recipient handoff → `TRY YOUR OWN`.

Secondary analytical and export actions may exist, but they must not compete with the primary loop.

## 3. Zero setup before value

The first useful session should require:

- no account;
- no upload;
- no object taxonomy form;
- no calibration ritual beyond what the application can perform automatically;
- no manual DSP settings;
- no requirement to understand the validation system.

Microphone permission is requested only when the user intentionally starts acquisition. Browsing saved or shared fingerprints must not request it.

## 4. Local first by default

Raw microphone PCM remains local under the current product contract.

Local history stores fingerprints, not recordings. Saved fingerprints remain playable because reconstruction derives from modes. Acoustic Capsules transmit fingerprint data deliberately chosen for sharing, not raw PCM.

A future network service must justify every new piece of remotely stored data instead of treating upload as the default architecture.

## 5. Virality comes from transferable utility

The desired growth loop is participation, not a generic social feed.

A discovery should create an artifact another person can understand and use immediately:

**I hit something → I found a surprising ring → I send it → you hear/play it → you try something around you → you send yours.**

The current complementary artifacts are:

- Acoustic DNA for visual recognition;
- Acoustic Story for self-contained presentation;
- Acoustic Capsule for the lowest-friction interactive recipient journey.

Future challenges and collections should amplify this loop without requiring premature physical-object identity claims.

## 6. Every shared claim must be earned

Consumer language must remain within the actual measurement contract.

Current allowed interpretation centers on **estimated audible resonances supported by the recorded transient**.

Do not silently promote:

- a fingerprint into complete structural eigenmodes;
- a signature into physical-object identity;
- a material label into material identification;
- close frequency pairs into proof of a shared physical mode;
- a shared capsule into authenticated provenance;
- a good-looking reconstruction into validated perceptual fidelity.

The product can be exciting without overstating what was measured.

## 7. Capture observation and physical object remain separate

A successful strike creates a capture observation.

Two captures with equal signatures remain two capture observations. Two similar fingerprints do not establish one object. Two dissimilar fingerprints do not establish different objects.

Canonical specimen identity exists in controlled empirical workflows because the physical object is externally tracked there. Consumer identity and future Sonic Twin semantics must be earned through a separate calibrated program.

## 8. Mobile is the reference interaction surface

The product should be excellent on a phone, not merely responsive.

The reference mobile experience requires:

- no horizontal overflow;
- safe-area-aware spacing;
- practical touch geometry;
- large primary actions;
- chromatic keys that remain physically playable;
- no accidental text selection during musical interaction;
- recoverable microphone permission behavior;
- clear background/audio lifecycle;
- keyboard and focus semantics for accessibility;
- reduced-motion support.

Desktop should gain space and detail without changing the conceptual flow.

## 9. Failure should preserve curiosity

Consumer failure states should explain the next useful action in plain language.

Permission denial, weak strikes, excessive noise, unsupported playback, malformed shared links, and local-storage failure should never strand the user on a blank or technically worded surface.

When a secondary capability fails, preserve the primary value when possible. Examples include keeping a successful fingerprint visible when history storage fails, or keeping DNA/Story sharing available if link sharing cannot be copied.

## 10. Product state must not contaminate empirical state

`main` is the empirical authority during an active frozen campaign. Product development belongs on the separate integration trunk until an explicit new empirical qualification cycle is declared.

Consumer convenience features must not mutate:

- acquisition thresholds;
- DSP estimator semantics;
- qualified-attempt accounting;
- evidence contracts;
- release thresholds;
- campaign manifests;
- validation provenance.

A product feature may reuse a validated fingerprint. It must not retroactively change what that measurement means.

## 11. Network features follow semantic foundations

The desired long-term trajectory is:

**instrument → private discovery collection → calibrated comparison → acoustic object/measurement graph → Resonance Atlas → network effects.**

The order matters.

Public identity, deduplication, Sonic Twin, clustering, and Atlas-scale discovery require explicit ground truth, calibrated uncertainty, provenance, moderation, persistence, and migration rules. They should not be inferred from a convenient hash or UI similarity score.

## 12. Measure the loop that creates delight

When product telemetry becomes appropriate, optimize for the physical discovery loop rather than vanity engagement.

Useful product questions include:

- Can a new user reach a successful reveal from the landing page?
- Do recipients of a shared discovery hear or play it?
- Do recipients proceed to `TRY YOUR OWN`?
- Do successful users make another strike?
- Do users return to saved fingerprints?
- Do comparisons and collections create more physical exploration?

Any future telemetry design must preserve the local-first privacy model and must not require raw microphone content.

## Product test

Before adding a consumer feature, ask:

1. Does it make the physical-world discovery loop easier, more surprising, more reusable, or more shareable?
2. Can a first-time user understand the action without reading technical documentation?
3. Does it preserve the scientific interpretation boundary?
4. Does it preserve the local-first privacy boundary?
5. Does it strengthen the path from one person's discovery to another person's physical experiment?

If the answer is no, the feature probably belongs in the lab, a later research phase, or nowhere.
