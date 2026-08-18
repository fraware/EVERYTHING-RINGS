# Acoustic DNA card

The Acoustic DNA card is a portable visual artifact derived only from an `AcousticFingerprintV1`. It exists to make a successful local measurement legible and shareable without exporting microphone PCM, adding remote storage, or extending the analytical claim.

## Contract

For a fixed fingerprint, `createAcousticCardSvg` produces the same standalone 1080 × 1350 SVG. The card contains:

- the Acoustic DNA V1 rendering;
- the deterministic Acoustic DNA signature;
- the fingerprint algorithm version;
- the number of estimated resonances;
- the minimum-to-maximum frequency span of the fingerprint; and
- the claim boundary: **Estimated audible resonances from one recorded transient.**

The card contains no raw microphone samples, object identity, material classification, location, account identifier, or inferred structural-mode label.

## Provenance boundary

The card is a presentation artifact, not a release-evidence bundle. It does not satisfy Gate A2, Gate B, or Gate C and must never be counted toward those gates. Release evidence continues to use the frozen validation schemas and exact software-revision binding defined in the validation documentation.

The Acoustic DNA signature identifies the canonical measured mode structure used by Acoustic DNA V1. The algorithm version is displayed separately so a shared card retains the analysis provenance needed to interpret that structure.

## Sharing behavior

The consumer surface creates the SVG locally after a successful capture. When browser-native file sharing supports the generated SVG, **SHARE DNA** invokes that mechanism. Otherwise the same locally generated SVG is downloaded. No network upload is required by either path.

## Versioning

Changes to visual layout that preserve the same encoded quantities do not change the acoustic fingerprint or Acoustic DNA signature. Any future card format that adds analytical quantities, inferred labels, or a different canonical encoding must be versioned explicitly and must preserve the scientific claim boundary above.
