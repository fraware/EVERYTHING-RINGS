# Software release checklist

Use this checklist for any named software revision on `post-freeze-development`. It does not authorize empirical claims. Completing it never implies physical-object identity, microphone validity, material identity, or human-perceptual evidence.

Empirical authority remains `main` / `freeze/gate-a2-v8-2026-08-25` at `717a4c15a3b15e73c5883f34b86897c03ff70829`. Do not merge research or product work into `main` during the active v8 sequence. Do not change Gate A2/B/C thresholds or frozen contract semantics to "complete" a release.

## License (#82)

Issue #82 did not name a license. This tree records **MIT** in the root `LICENSE` file pending any owner amendment. Do not rewrite git history if the owner later selects a different license; add the new `LICENSE` on a subsequent commit. Dataset, model, and physical-corpus terms may require separate licenses later and are not implied by the software MIT grant.

## Record these identifiers

Copy exact values. Do not abbreviate commit SHAs.

| Field | How to obtain | Value |
|-------|----------------|-------|
| Branch | Must be `post-freeze-development` or a branch from it. Never `main` for post-freeze software. | |
| Exact commit | `git rev-parse HEAD` (40 hex) | |
| Tree | `git rev-parse HEAD^{tree}` | |
| Tag / freeze name | Only after this revision itself is qualified. | |
| Ordinary CI run | GitHub Actions workflow `ci`, job `validate` | |
| Digital-twin qualification run | workflow `digital-twin-qualification` | |
| Full-vision software qualification run | workflow `full-vision-software-qualification` | |
| SBOM workflow/job run | CycloneDX JSON artifact from the qualification `sbom` job | |
| Atlas production-conformance run | workflow `atlas-production-conformance` (skeleton until `apps/atlas-api` exists) | |
| Qualification report digest | SHA-256 of the uploaded `full-vision-software.json` bytes | |
| Digital-twin report digest | SHA-256 of the uploaded digital-twin JSON bytes | |
| SBOM digest | SHA-256 of the uploaded CycloneDX JSON bytes | |
| Capability claims | Entries in `docs/CLAIM_REGISTRY.md` plus any machine-readable `CapabilityClaimV1` IDs | |
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

List every product-facing proposition this revision is allowed to support, with maturity from `docs/CLAIM_REGISTRY.md`. Software qualification may support deterministic execution, artifact integrity, synthetic recovery, and named digital-population metrics. It does not support physical-object identity, material identity in the world, calibrated loudness, microphone-transducer behavior, or playback-chain fidelity.

Machine-readable claims, when emitted, use `CapabilityClaimV1` in `packages/validation`. The human-readable registry is the index. Do not promote a registry row past the evidence actually attached.

## Known exclusions (required)

State at least:

- No physical campaign object was tested by this software qualification.
- Gate A2/B/C status is independent of this checklist; see E1 below.
- `?twin=1` and `?atlas=1` remain synthetic demonstrations.
- Predicted spatial fingerprints remain `evidenceEligible: false`.
- Material inference remains research-only (`evidenceEligible: false`) until a held-out physical claim is earned.

## Schema migration discipline

`packages/validation` owns versioned artifact schemas. This checklist does not change those packages. Every new or bumped artifact contract (`schemaVersion` / `*ContractVersion`) requires, in the validation package, before the contract is used in a release:

1. a parser that fails closed on unsupported versions;
2. a validator / content-address verification test;
3. an explicit migration test through `ArtifactMigrationRegistryV1` when a prior contract version must still be read.

CI comments in the qualification and Atlas conformance workflows restate this rule. Missing migration tests block adopting a new artifact version, not the frozen v8 evidence contract (`validation-evidence-5` / `schemaVersion: 5`).

## E1 — empirical v8 support (tooling only)

Physical sequence, do not reorder:

`#64 intended-device preflight → #65 specimen/manifest freeze → #66 collection / #25 Gate A2 adjudication → #28 Gate B → #29 Gate C`

This repository's software cannot execute that campaign. Independent verification tooling (`pnpm --filter @everything-rings/er-cli`) hashes source bytes and verifies evidence JSON against schema v5. It must never reserialize source evidence when reporting an original digest. It must never become part of the frozen evidence-production path.

**E1 exit:** Gate A2/B/C status is recorded under the frozen contracts, whether PASS or fail. Failure is an experimental result. Engineers must not change thresholds, attempt counts, or contract versions to obtain a pass.

Record gate status here when it exists (PASS / fail / not-yet-run). Do not leave E1 "done" by software work alone.

| Gate | Contract | Status | Evidence artifact digest | Notes |
|------|----------|--------|--------------------------|-------|
| A2 | `gate-a-2` / `validation-evidence-5` | not-yet-run | | Physical collection not performed in software |
| B | `gate-b-1` | not-yet-run | | |
| C | `gate-c-1` | not-yet-run | | |

## Branch protection / rulesets (#81)

Required GitHub rulesets (repository policy only; not scientific evidence):

### Ruleset A — `authority-pr-required`

- Target: `refs/heads/main`, `refs/heads/post-freeze-development`
- Enforcement: active
- Rules:
  - `deletion` (block branch deletion)
  - `non_fast_forward` (block force-push)
  - `pull_request` with `required_review_thread_resolution: true`, `required_approving_review_count: 0` until additional reviewers exist, `require_code_owner_review: false` until additional GitHub users exist, `dismiss_stale_reviews_on_push: true`
  - `required_status_checks` with `strict_required_status_checks_policy: true` and check context `validate` (workflow `ci`, job `validate`; GitHub Actions app integration id `15368`)
- No bypass actors. A direct unreviewed push must be rejected.

When additional maintainers exist, raise `required_approving_review_count` to 1 and set `require_code_owner_review: true`.

### Ruleset B — `immutable-freeze-refs`

- Target: `refs/heads/freeze/**`
- Enforcement: active
- Rules: `deletion`, `non_fast_forward` only
- New `freeze/*` refs may be created; existing freeze refs must not be rewritten or deleted.

Example create payloads (REST `POST /repos/fraware/EVERYTHING-RINGS/rulesets`):

```json
{
  "name": "authority-pr-required",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main", "refs/heads/post-freeze-development"],
      "exclude": []
    }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "validate", "integration_id": 15368 }
        ]
      }
    }
  ]
}
```

```json
{
  "name": "immutable-freeze-refs",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/freeze/**"],
      "exclude": []
    }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" }
  ]
}
```

If the API rejects the create (permissions, enterprise policy, or check-name mismatch), record the HTTP status here and keep this section as the required configuration.

**Applied 2026-08-25** (authenticated `gh api` as repository admin):

- `authority-pr-required` id `21426242` — [ruleset](https://github.com/fraware/EVERYTHING-RINGS/rules/21426242)
- `immutable-freeze-refs` id `21426245` — [ruleset](https://github.com/fraware/EVERYTHING-RINGS/rules/21426245)

GitHub stored additional pull-request defaults (`allowed_merge_methods`, `require_extra_approval_for_unattributed_changes`). Bypass actors remain empty (`current_user_can_bypass: never`). Direct pushes to `main` and `post-freeze-development` must go through a pull request; `ci` job `validate` is required; `freeze/**` cannot be force-pushed or deleted.

Observed before apply: classic branch protection was off for `main` and `post-freeze-development`, and `GET /repos/fraware/EVERYTHING-RINGS/rulesets` returned `[]`.

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

`freeze dataset` and `inspect lineage` are stubs until E2. They exit 2 and must not be treated as a freeze or a lineage proof.
