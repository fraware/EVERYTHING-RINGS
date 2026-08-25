# Software release checklist

Use this checklist for any named software revision on `post-freeze-development`. It does not authorize empirical claims. Completing it never implies physical-object identity, microphone validity, material identity, or human-perceptual evidence.

Empirical authority remains `main` / `freeze/gate-a2-v8-2026-08-25` at `717a4c15a3b15e73c5883f34b86897c03ff70829`. Do not merge research or product work into `main` during the active v8 sequence. Do not change Gate A2/B/C thresholds or frozen contract semantics to complete a software release.

## Software license

Repository software is licensed under the root **MIT License**. The root package metadata and contribution guide should remain aligned with `LICENSE`.

Dataset, trained-model, media, benchmark-corpus, and future physical-corpus artifacts may require separate terms. The software license must not be described as automatically licensing separately identified data or third-party content.

## Record these identifiers

Copy exact values. Do not abbreviate commit SHAs.

| Field | How to obtain | Value |
|-------|----------------|-------|
| Branch | Must be `post-freeze-development` or a branch from it. Never `main` for post-freeze software. | |
| Exact commit | `git rev-parse HEAD` (40 hex) | |
| Tree | `git rev-parse HEAD^{tree}` | |
| Tag / freeze name | Only after this revision itself is qualified. | |
| Ordinary CI run | workflow `ci`, job `validate` | |
| Digital-twin qualification run | workflow `digital-twin-qualification` | |
| Full-vision software qualification run | workflow `full-vision-software-qualification` | |
| Atlas software-conformance run | workflow `atlas-production-conformance` | |
| SBOM workflow/job run | CycloneDX JSON artifact from the qualification `sbom` job | |
| Qualification report digest | SHA-256 of uploaded `full-vision-software.json` bytes | |
| Digital-twin report digest | SHA-256 of uploaded digital-twin JSON bytes | |
| Atlas conformance report digest | SHA-256 of uploaded Atlas conformance JSON bytes | |
| SBOM digest | SHA-256 of uploaded CycloneDX JSON bytes | |
| Capability claims | `docs/CLAIM_REGISTRY.md` plus machine-readable registry/claim IDs | |
| Known exclusions | Must include: software qualification is not physical evidence | |

Reproducibility command on a clean checkout of the named revision:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

Installs must use the committed `pnpm-lock.yaml`. Do not update the lockfile as part of a qualification run.

## Capability claims

List every product-facing proposition this revision is allowed to support, with maturity from `docs/CLAIM_REGISTRY.md`. Software qualification may support deterministic execution, artifact integrity, synthetic recovery, local service behavior, and named digital-population metrics. It does not support physical-object identity, material identity in the world, calibrated loudness, microphone-transducer behavior, or playback-chain fidelity.

Machine-readable maturity and assurance objects live in `packages/validation`. The human-readable registry is the project index. Do not promote a registry row past the evidence actually attached.

## Known exclusions — required

State at least:

- No physical campaign object was tested by software qualification.
- Gate A2/B/C status is independent of this checklist.
- `?twin=1` and `?atlas=1` remain synthetic/local research surfaces.
- Predicted spatial fingerprints remain non-measurement outputs and are not evidence-eligible measurements.
- Material inference remains research-only until a held-out physical claim is earned.
- Atlas client/API conformance is a local software-contract qualification, not a public production-network qualification.
- Content digests establish byte identity, not the truth of physical specimen/material assertions.

## Schema migration discipline

`packages/validation` owns versioned artifact schemas. Every new or bumped artifact contract (`schemaVersion` / `*ContractVersion`) requires, before use in a named release:

1. a parser that fails closed on unsupported versions;
2. validator/content-address verification tests;
3. an explicit migration test through the artifact migration registry when a prior contract version must remain readable;
4. exact test vectors for content-addressed contracts where cross-runtime stability matters.

This discipline does not alter the frozen v8 evidence contract (`validation-evidence-5` / `schemaVersion: 5`).

## Atlas software-contract conformance

The repository now contains both `@everything-rings/atlas-client` and `@everything-rings/atlas-api`. The API has memory and local file-backed storage paths plus HTTP, persistence, service-conformance, and Atlas V2 tests.

The `atlas-production-conformance` workflow therefore runs those packages directly. A successful report may state only that the named software revision passed the checked local contracts. It must retain:

- `softwareOnly: true`;
- `physicalObjectTested: false`;
- `releaseGateEquivalent: false`;
- `publicNetworkQualified: false`.

Public-network production remains downstream of authentication/authorization, rate limits and abuse controls, multi-tenant durability/backup/restore, operational rollback/recovery, deployment security review, and load/concurrency characterization.

## E1 — empirical v8 support

Physical sequence, do not reorder:

`#64 intended-device preflight → #65 specimen/manifest freeze → #66 collection / #25 Gate A2 adjudication → #28 Gate B → #29 Gate C`

This repository's post-freeze software cannot execute or substitute for that campaign. Independent verification tooling may hash source bytes and verify schema-v5 evidence, but it must never reserialize source evidence when reporting an original digest and must never become part of the frozen evidence-production path.

**E1 exit:** Gate A2/B/C status is recorded under the frozen contracts, whether PASS or fail. Failure is an experimental result. Engineers must not change thresholds, attempt counts, or contract versions to obtain a pass.

| Gate | Contract | Status | Evidence artifact digest | Notes |
|------|----------|--------|--------------------------|-------|
| A2 | `gate-a-2` / `validation-evidence-5` | not-yet-run | | Physical collection not performed in software |
| B | `gate-b-1` | not-yet-run | | |
| C | `gate-c-1` | not-yet-run | | |

## Repository rulesets

The authority branches and freeze refs are protected by active repository rulesets applied 2026-08-25:

- `authority-pr-required` — id `21426242`;
- `immutable-freeze-refs` — id `21426245`.

Required authority behavior:

- `main` and `post-freeze-development` require pull requests;
- the `ci` / `validate` check is required;
- force pushes and deletion are blocked;
- review threads must be resolved;
- `freeze/**` refs cannot be force-pushed or deleted;
- bypass actors remain empty.

When additional maintainers exist, require at least one approving review and CODEOWNER review for authority-branch changes.

## GitHub Actions pins

Workflows must pin `uses:` to full commit SHAs, not floating tags. Current pins:

| Action | SHA | Tag (comment only) |
|--------|-----|--------------------|
| `actions/checkout` | `3d3c42e5aac5ba805825da76410c181273ba90b1` | v7.0.1 |
| `actions/setup-node` | `249970729cb0ef3589644e2896645e5dc5ba9c38` | v6.5.0 |
| `actions/upload-artifact` | `ea165f8d65b6e75b540449e92b4886f43607fa02` | v4.6.2 |
| `actions/configure-pages` | `983d7736d9b0ae728b81ab479565c72886d7745b` | v5.0.0 |
| `actions/upload-pages-artifact` | `7b1f4a764d45c48632c6b24a0339c27f5614fb0b` | v4.0.0 |
| `actions/deploy-pages` | `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` | v4.0.5 |
| `anchore/sbom-action` | `e22c389904149dbc22b58101806040fa8d37a610` | v0.24.0 |

## Independent verification CLI

```bash
pnpm --filter @everything-rings/er-cli test
pnpm --filter @everything-rings/er-cli typecheck
pnpm --filter @everything-rings/er-cli exec node ./bin/er.mjs hash path/to/file.json
pnpm --filter @everything-rings/er-cli exec node ./bin/er.mjs verify evidence path/to/evidence.json
pnpm --filter @everything-rings/er-cli exec node ./bin/er.mjs verify measurement path/to/measurement.json
pnpm --filter @everything-rings/er-cli exec node ./bin/er.mjs verify derivation path/to/derivation.json
pnpm --filter @everything-rings/er-cli exec node ./bin/er.mjs verify repository path/to/repository.json
```

Verification tooling reports the contracts it actually checks. A command name or successful hash is never itself a scientific maturity promotion.
