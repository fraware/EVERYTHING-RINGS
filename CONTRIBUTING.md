# Contributing

EVERYTHING RINGS combines a consumer acoustic instrument with empirical measurement and validation infrastructure. Contributions are welcome, but changes must preserve the distinction between product behavior, research diagnostics, and evidence-eligible empirical contracts.

## Development setup

Use the repository-declared pnpm version and frozen lockfile:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
bash scripts/browser-smoke.sh
```

## Change classes

### Product-only changes

Consumer UI, local history, sharing, visualization, and other non-empirical features belong on the product development line. They must not be merged into a frozen empirical authority revision solely for convenience.

### Research/diagnostic changes

Alternative DSP configurations, digital twins, external datasets, similarity baselines, and future embeddings must clearly state whether their output is evidence-eligible. Custom analysis configurations must not claim an `er-dsp-*` canonical algorithm version unless a new algorithm contract is explicitly versioned.

### Empirical-contract changes

Changes to acquisition semantics, DSP parameters, evidence schemas, campaign design, gate thresholds, review-plan selection, or Release Console authority require explicit versioning and requalification before new physical evidence is accepted. Do not relax a frozen threshold or omit a failed observation to make an observed dataset pass.

## Pull requests

A pull request should state:

- the intended change class;
- which claim or product behavior changes, if any;
- whether evidence semantics change;
- tests added or updated;
- whether a prior empirical revision must be superseded or requalified.

Keep machine contracts, documentation, and advertised claims synchronized. A nearby or weaker theorem/test must not be presented as evidence for a stronger proposition.

## Privacy

Do not commit microphone PCM, private Gate B listening companions, device identifiers that should remain local, secrets, or user-private artifacts. Synthetic/digital-twin signals are acceptable when clearly labeled non-physical.

## Licensing

The repository currently has an open issue to choose an explicit project license. Until that decision is made, public repository visibility should not be interpreted as a grant of reuse rights beyond GitHub's platform terms. Contribution licensing language will be finalized with the repository license decision.
