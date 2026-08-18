# Campaign authoring

`?campaign-author=1` creates the physical precommitment used by `empirical-campaign-1`. Use it only after the software implementation is frozen and before any candidate specimen is run through the production analysis pipeline.

## Recommended 12-slot design

The author starts from twelve fixed selection slots.

The six **release-core** slots require two metal, two glass, and two ceramic specimens, with different object families within each material pair.

The six **challenge** slots target distinct failure boundaries:

1. strongly damped / short-decay object;
2. weak or broad resonant structure;
3. heterogeneous or coupled multi-part object;
4. high-Q object with long decay or closely spaced peaks;
5. small or weakly radiating object near the SNR floor;
6. geometry likely to produce near-degenerate or strike-location-sensitive modes.

The slot criteria are predeclared. The actual specimen identities must come from real physical objects selected without first screening their production-analysis outcome.

## Fields that must be frozen

Each physical specimen requires:

- stable specimen ID;
- specific object label;
- object family;
- material;
- target session count;
- microphone distance;
- striker;
- exact strike location;
- exact support condition.

The author pre-fills only the two protocol constants intentionally standardized for the first campaign: **20 cm microphone distance** and **wooden dowel striker**. Physical identity, object family, strike point, and support remain blank until the operator specifies the real object.

The author rejects incomplete rows, non-positive timing/count quantities, duplicate specimen IDs after canonical normalization, unstamped builds, and any manifest that fails the downstream runtime parser.

## Revision freeze

The exported manifest authorizes the exact 40-hex software revision displayed by the running build. After export, that revision is part of the experiment.

Do not merge another software change and then collect under the old manifest. Either collect using the exact authorized revision or deliberately create a new campaign manifest for the new revision. This keeps algorithm/UI changes from entering the same physical campaign invisibly.

## Export

When all twelve physical rows are complete, the author computes the same deterministic `erc1-*` signature used by campaign accounting and enables **FREEZE + EXPORT CAMPAIGN**.

The resulting JSON is then used in two places:

1. `?campaign=1` binds physical collection to the planned specimen identity/setup and authorized revision.
2. `?release=1` accounts for missing, failed, mismatched, extra, and unplanned evidence before release-gate evaluation.

Keep the exported manifest unchanged for the entire campaign. If the scientific design itself changes, create and identify a new campaign instead of editing the old manifest in place.
