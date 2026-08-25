# Acoustic Capsule

Acoustic Capsule v1 is the share transport for a consumer fingerprint.

Its product purpose is simple:

**STRIKE → REVEAL → SHARE LINK → OPEN → HEAR → PLAY → TRY YOUR OWN**

The transport is intentionally narrower than an acoustic object record. It moves enough measured fingerprint data to recreate the local visual and synthesized experience on another browser. It does not establish physical-object identity, source authenticity, release eligibility, or long-term addressability.

## Wire contract

A capsule is encoded in the URL fragment:

```text
#ring=<base64url ASCII JSON>
```

The v1 wire object contains only:

- `v` — transport version, currently `1`;
- `a` — fingerprint algorithm version;
- `r` — native fingerprint sample rate in Hz;
- `d` — analyzed duration in seconds;
- `s` — deterministic Acoustic DNA signature;
- `m` — ordered mode tuples containing frequency, relative amplitude, fitted decay, Q, confidence, and existing mode diagnostics.

No microphone sample array, account identifier, specimen identifier, label, material class, location, or remote storage key is present.

The URL constructor removes query state before adding the fragment. A shared consumer link therefore cannot accidentally preserve `?lab=1`, campaign, or release-console routing.

## Frozen v1 validation envelope

The recipient parser fails closed. Its limits are part of the v1 transport semantics rather than UI hints.

It requires:

- exact top-level keys;
- transport version `1`;
- a fingerprint algorithm version known to the running application;
- integer sample rate from 8 kHz through 384 kHz;
- positive analyzed duration no greater than **8 seconds**;
- one through sixteen modes;
- mode frequency from **80 Hz** up to the smaller of 12 kHz and Nyquist;
- relative amplitude in `[0.001, 1]`;
- confidence in `[0.55, 1]`;
- positive fitted decay no greater than 60 seconds;
- Q consistent with `π × frequency × decay` to within 0.1% relative tolerance;
- peak prominence of at least 8 dB;
- track persistence from 0.08 seconds through the analyzed duration;
- frequency standard deviation from 0 through 18 cents;
- decay-fit score in `[0, 1]`;
- integer observation count of at least 8;
- a valid `er1-*` signature;
- exact equality between the transported signature and the signature recomputed under the existing Acoustic DNA signature function.

These bounds mirror broad invariants already imposed by the frozen canonical analysis/selection path and add a conservative resource envelope for a public share transport. The standard acquisition path records 2.8 seconds after trigger; an 8-second capsule ceiling leaves substantial headroom without accepting arbitrary long render requests.

The complete fragment is limited to 8,192 characters. Oversized, malformed, structurally contradictory, unknown-version, unsupported-algorithm, and signature-inconsistent capsules are rejected to a recoverable consumer landing surface.

Creation uses the same parser as consumption. The application therefore refuses to emit a capsule that it would later reject.

## Signature semantics

The `er1-*` Acoustic DNA signature is preserved because it is the existing human-visible fingerprint shorthand. It is **not a full-content checksum**.

Its canonicalization covers the fields defined by the Acoustic DNA signature function, including modal frequency, fitted decay, relative amplitude, and confidence. Other carried diagnostics and Q are checked independently by the capsule parser but are not authenticated by the `er1-*` value.

Consequently, `signature matched` means only that the reconstructed fingerprint agrees with the existing signature semantics. It must never be described as cryptographic integrity, source authentication, or complete-byte identity.

## Privacy boundary

The fragment is used because standard HTTP requests do not send the fragment component to the origin server. EVERYTHING RINGS does not require a fingerprint upload or account to create or open a capsule.

This is a transport privacy property, not secrecy. The fragment remains visible to the browser, client-side application code, clipboard/history surfaces, screenshots, recipients, and any software to which the user deliberately shares the URL. A capsule should be treated as intentionally shared fingerprint data.

Microphone PCM is absent. Recipient open, model playback, chromatic playback, and reshare require no microphone permission.

## Trust boundary

A structurally valid capsule is not authenticated provenance.

The parser can establish that:

- the payload satisfies the declared v1 format;
- its quantities satisfy the frozen v1 structural/resource envelope;
- the modal Q value is internally consistent with frequency and decay;
- its existing Acoustic DNA signature matches the subset of fingerprint fields that signature canonicalizes.

It cannot establish:

- who created the link;
- which device produced the underlying measurement;
- whether the payload came from a real physical strike;
- whether two capsules describe the same physical object;
- whether the data passed Gate A2/B/C;
- whether every transported field originated from the canonical estimator;
- whether the link is an immutable or permanent record.

The `er1-*` signature remains descriptive fingerprint shorthand. It is not a collision-resistant physical-object identifier and must never be used for object deduplication.

## Recipient experience

The shared surface is consumer-first:

1. show Acoustic DNA immediately;
2. expose one dominant `HEAR THIS RING` action;
3. reveal the chromatic instrument through `PLAY IT`;
4. show compact resonance count, frequency range, algorithm revision, and signature;
5. state the fingerprint/original-recording, provenance, and identity boundaries;
6. hand the recipient directly into local acquisition with `TRY YOUR OWN`;
7. allow `SHARE AGAIN` without changing the capsule semantics.

The recipient surface deliberately avoids validation-lab controls, capture provenance claims, similarity scores, and identity language.

## Audio lifecycle and resource boundary

Shared playback reuses the output-only fingerprint player used by saved captures.

- no `getUserMedia` call occurs to open or play a capsule;
- the audio context is created lazily on direct playback interaction;
- model playback renders at the recipient browser's output sample rate, not an attacker-selected output rate from the payload;
- v1 caps analyzed duration at 8 seconds and mode count at 16 before rendering;
- the realtime worklet is needed only for chromatic note playback;
- realtime synthesis independently caps voices and modes and filters modes against the actual output Nyquist limit;
- page hide, backgrounding, payload replacement, and unmount silence/dispose playback resources;
- changing from one valid capsule fragment to another cannot leave the prior fingerprint bound to the audio controller.

`TRY YOUR OWN` first removes the capsule fragment and releases shared-playback state, then starts the ordinary microphone flow from the same deliberate user gesture.

## Mobile and accessibility contract

At the 390×844 reference phone viewport:

- the shared surface has no horizontal overflow;
- visible interactive controls maintain practical touch height;
- thirteen chromatic notes remain available but wrap into practical-width columns;
- keyboard activation remains available;
- focus-visible states remain explicit;
- safe-area insets are respected on every edge;
- reduced-motion preferences suppress incidental motion without removing information or controls.

## Distribution tradeoff

Fragment-only transport prevents the server from reading the per-capsule fingerprint during a normal request. That means server-rendered social preview metadata cannot vary by capsule without adding another publication service.

The product keeps the privacy property and uses complementary share surfaces instead:

- **Acoustic Capsule** — lowest-friction interactive link;
- **Acoustic DNA** — static visual artifact;
- **Acoustic Story** — self-contained sound-and-motion artifact.

A future public publishing service would require a separate privacy, moderation, provenance, and persistence design. It must not be smuggled into the v1 capsule contract.

## Browser release contract

The dedicated browser journey must prove:

- a real history card creates a capsule through the product UI;
- payload state exists only in the fragment;
- recipient rendering retains the expected signature and trust-boundary copy;
- recipient model and chromatic playback request the microphone zero times;
- phone layout and key geometry remain usable;
- reshare preserves capsule semantics;
- a second valid capsule opened in the same tab replaces the prior signature and playback binding;
- `TRY YOUR OWN` clears the fragment and requests the microphone exactly once;
- malformed and oversized fragments recover to the consumer landing only after the new fragment state has actually committed;
- no capsule path mutates local capture history implicitly.

## Versioning

Any incompatible wire or validation-envelope change creates another transport version. A future implementation may continue reading v1 while emitting a newer version, but it must never reinterpret an existing v1 field or silently loosen v1 structural semantics in place.

Acoustic Capsule versioning is independent of fingerprint algorithm versioning, renderer versioning, future canonical measurement records, and future identity/similarity models.
